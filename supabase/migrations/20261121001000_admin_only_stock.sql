-- =============================================================================
-- Stocks réservés à l'administrateur : lui seul approvisionne ou ajuste le
-- stock et consulte les mouvements. La permission « manage_stock » n'est plus
-- proposée et est retirée des comptes qui l'avaient.
-- (Les produits et leurs photos étaient déjà réservés à l'administrateur.)
-- =============================================================================

create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text default null
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Seul l''administrateur peut modifier les stocks.' using errcode = '42501';
  end if;
  if p_movement_type not in ('restock', 'adjustment') then
    raise exception 'Type de mouvement invalide.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity = 0 or abs(p_quantity) > 1000000 then
    raise exception 'La quantité est invalide.' using errcode = 'P0001';
  end if;
  if p_movement_type = 'restock' and p_quantity < 0 then
    raise exception 'Un approvisionnement doit avoir une quantité positive.' using errcode = 'P0001';
  end if;
  if p_movement_type = 'adjustment' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Le motif de l''ajustement est obligatoire.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Le motif est trop long (500 caractères maximum).' using errcode = 'P0001';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produit introuvable.' using errcode = 'P0001';
  end if;
  if not public.can_see_shop(v_product.shop_id) then
    raise exception 'Produit introuvable.' using errcode = 'P0001';
  end if;
  if not v_product.track_stock then
    raise exception 'Le suivi de stock n''est pas activé pour « % ».', v_product.name using errcode = 'P0001';
  end if;

  v_new_stock := v_product.stock_quantity + p_quantity;
  if v_new_stock < 0 then
    raise exception 'Le stock ne peut pas devenir négatif (disponible : %).', v_product.stock_quantity
      using errcode = 'P0001';
  end if;

  update public.products set stock_quantity = v_new_stock where id = p_product_id;

  insert into public.stock_movements (product_id, movement_type, quantity, stock_after, reason, user_id)
  values (p_product_id, p_movement_type::public.stock_movement_type, p_quantity, v_new_stock, v_reason, v_uid);

  perform public.write_audit_log(
    'stock.' || p_movement_type, 'products', p_product_id::text,
    jsonb_build_object(
      'product_name', v_product.name,
      'quantity', p_quantity,
      'stock_after', v_new_stock,
      'reason', v_reason
    )
  );

  return v_new_stock;
end;
$$;

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using ((select public.is_admin()));

update public.profiles
   set permissions = array_remove(permissions, 'manage_stock')
 where 'manage_stock' = any (permissions);
