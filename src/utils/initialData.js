export const INITIAL_BOUTIQUES = [
  {
    id: 'b1',
    name: 'Boutique Centre',
    location: 'Avenue Centrale, Abidjan',
    manager: 'Mamadou Diallo',
    phone: '+225 07 01 02 03 04',
    color: '#6366f1' // Indigo
  },
  {
    id: 'b2',
    name: 'Boutique Port',
    location: 'Zone Portuaire, San Pedro',
    manager: 'Aminata Touré',
    phone: '+225 05 02 03 04 05',
    color: '#10b981' // Emerald
  },
  {
    id: 'b3',
    name: 'Boutique Palmeraie',
    location: 'Bd Mitterrand, Palmeraie',
    manager: 'Kouassi Jean',
    phone: '+225 01 03 04 05 06',
    color: '#f59e0b' // Amber
  }
];

export const CATEGORIES = [
  { id: 'charbon', label: 'Charbon & Combustibles', icon: 'Flame' },
  { id: 'aromes', label: 'Arômes & Goûts', icon: 'Sparkles' },
  { id: 'chicha', label: 'Chichas & Équipements', icon: 'Wind' },
  { id: 'tuyaux', label: 'Tuyaux & Accessoires', icon: 'Activity' },
  { id: 'pipes', label: 'Pipes & Divers', icon: 'Package' }
];

export const INITIAL_PRODUCTS = [
  // Charbon
  {
    id: 'p1',
    name: 'Charbon Coconut Premium 1kg',
    category: 'charbon',
    buyPrice: 2500,
    sellPrice: 4500,
    minAlertStock: 15,
    stocks: { b1: 45, b2: 12, b3: 28 }, // b2 is low stock (< 15)
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p2',
    name: 'Charbon Auto-allumant Belgocida (Boîte 100)',
    category: 'charbon',
    buyPrice: 1800,
    sellPrice: 3500,
    minAlertStock: 10,
    stocks: { b1: 30, b2: 25, b3: 8 }, // b3 low stock
    image: 'https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?auto=format&fit=crop&w=300&q=80'
  },

  // Arômes
  {
    id: 'p3',
    name: 'Arôme Double Pomme Al-Fakher 250g',
    category: 'aromes',
    buyPrice: 6000,
    sellPrice: 10000,
    minAlertStock: 8,
    stocks: { b1: 20, b2: 18, b3: 15 },
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p4',
    name: 'Arôme Menthe Fraîche Adalya 250g',
    category: 'aromes',
    buyPrice: 6000,
    sellPrice: 10000,
    minAlertStock: 8,
    stocks: { b1: 14, b2: 5, b3: 22 }, // b2 low stock
    image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p5',
    name: 'Arôme Love 66 Adalya 250g',
    category: 'aromes',
    buyPrice: 6500,
    sellPrice: 11000,
    minAlertStock: 10,
    stocks: { b1: 25, b2: 30, b3: 16 },
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p6',
    name: 'Arôme Pêche Glacée 250g',
    category: 'aromes',
    buyPrice: 5800,
    sellPrice: 9500,
    minAlertStock: 6,
    stocks: { b1: 10, b2: 12, b3: 4 }, // b3 low stock
    image: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=300&q=80'
  },

  // Chicha
  {
    id: 'p7',
    name: 'Chicha Celeste X-Glass Chrome',
    category: 'chicha',
    buyPrice: 25000,
    sellPrice: 45000,
    minAlertStock: 3,
    stocks: { b1: 6, b2: 4, b3: 2 }, // b3 low stock
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p8',
    name: 'Chicha Compact Travel LED',
    category: 'chicha',
    buyPrice: 14000,
    sellPrice: 24000,
    minAlertStock: 4,
    stocks: { b1: 8, b2: 9, b3: 5 },
    image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80'
  },

  // Tuyaux
  {
    id: 'p9',
    name: 'Tuyau Silicone Grip Carbon Pro',
    category: 'tuyaux',
    buyPrice: 3500,
    sellPrice: 7000,
    minAlertStock: 5,
    stocks: { b1: 15, b2: 10, b3: 12 },
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p10',
    name: 'Système de Chauffe Kaloud Plus',
    category: 'tuyaux',
    buyPrice: 5000,
    sellPrice: 9500,
    minAlertStock: 5,
    stocks: { b1: 11, b2: 3, b3: 9 }, // b2 low stock
    image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=300&q=80'
  },

  // Pipes
  {
    id: 'p11',
    name: 'Pipe en Bois de Rose Artisanale',
    category: 'pipes',
    buyPrice: 8500,
    sellPrice: 16000,
    minAlertStock: 3,
    stocks: { b1: 5, b2: 4, b3: 6 },
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'p12',
    name: 'Foyer Céramique Phunnel Gloss',
    category: 'pipes',
    buyPrice: 2000,
    sellPrice: 4200,
    minAlertStock: 8,
    stocks: { b1: 22, b2: 15, b3: 19 },
    image: 'https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?auto=format&fit=crop&w=300&q=80'
  }
];

export const INITIAL_CUSTOMERS = [
  { id: 'c1', name: 'Koffi Serge', phone: '+225 07 44 33 22', boutiqueId: 'b1', totalDebt: 19500 },
  { id: 'c2', name: 'Lounge Le Palmier', phone: '+225 05 11 22 33', boutiqueId: 'b3', totalDebt: 45000 },
  { id: 'c3', name: 'Yao Ibrahim', phone: '+225 01 99 88 77', boutiqueId: 'b2', totalDebt: 10000 },
  { id: 'c4', name: 'Shisha Club Port', phone: '+225 07 55 66 77', boutiqueId: 'b2', totalDebt: 0 }
];

export const INITIAL_SALES = [
  {
    id: 'V-1001',
    boutiqueId: 'b1',
    date: '2026-09-01T10:15:00Z',
    items: [
      { productId: 'p1', name: 'Charbon Coconut Premium 1kg', quantity: 2, unitPrice: 4500 },
      { productId: 'p3', name: 'Arôme Double Pomme Al-Fakher 250g', quantity: 1, unitPrice: 10000 }
    ],
    totalAmount: 19000,
    paymentMethod: 'cash', // 'cash', 'orange_money', 'credit'
    cashReceived: 20000,
    cashChange: 1000,
    omReference: null,
    customerName: 'Client Passant',
    seller: 'Mamadou Diallo'
  },
  {
    id: 'V-1002',
    boutiqueId: 'b1',
    date: '2026-09-01T11:40:00Z',
    items: [
      { productId: 'p7', name: 'Chicha Celeste X-Glass Chrome', quantity: 1, unitPrice: 45000 }
    ],
    totalAmount: 45000,
    paymentMethod: 'orange_money',
    cashReceived: null,
    cashChange: null,
    omReference: 'OM-89304192',
    customerName: 'Bamba K.',
    seller: 'Mamadou Diallo'
  },
  {
    id: 'V-1003',
    boutiqueId: 'b2',
    date: '2026-09-01T09:30:00Z',
    items: [
      { productId: 'p5', name: 'Arôme Love 66 Adalya 250g', quantity: 2, unitPrice: 11000 },
      { productId: 'p9', name: 'Tuyau Silicone Grip Carbon Pro', quantity: 1, unitPrice: 7000 }
    ],
    totalAmount: 29000,
    paymentMethod: 'cash',
    cashReceived: 30000,
    cashChange: 1000,
    omReference: null,
    customerName: 'Client Passant',
    seller: 'Aminata Touré'
  },
  {
    id: 'V-1004',
    boutiqueId: 'b3',
    date: '2026-09-01T12:05:00Z',
    items: [
      { productId: 'p2', name: 'Charbon Auto-allumant Belgocida', quantity: 3, unitPrice: 3500 },
      { productId: 'p4', name: 'Arôme Menthe Fraîche Adalya 250g', quantity: 1, unitPrice: 10000 }
    ],
    totalAmount: 20500,
    paymentMethod: 'credit',
    cashReceived: null,
    cashChange: null,
    omReference: null,
    customerName: 'Lounge Le Palmier',
    customerId: 'c2',
    dueDate: '2026-09-15',
    seller: 'Kouassi Jean'
  }
];

export const INITIAL_DEBTS = [
  {
    id: 'D-201',
    customerId: 'c1',
    customerName: 'Koffi Serge',
    phone: '+225 07 44 33 22',
    boutiqueId: 'b1',
    saleId: 'V-0988',
    date: '2026-08-28T14:20:00Z',
    dueDate: '2026-09-05',
    originalAmount: 24500,
    remainingAmount: 19500,
    status: 'partial', // 'pending', 'partial', 'paid'
    repayments: [
      {
        id: 'R-1',
        date: '2026-08-30T16:00:00Z',
        amount: 5000,
        paymentMethod: 'orange_money',
        omRef: 'OM-7739102',
        receivedBy: 'Mamadou Diallo'
      }
    ]
  },
  {
    id: 'D-202',
    customerId: 'c2',
    customerName: 'Lounge Le Palmier',
    phone: '+225 05 11 22 33',
    boutiqueId: 'b3',
    saleId: 'V-1004',
    date: '2026-09-01T12:05:00Z',
    dueDate: '2026-09-15',
    originalAmount: 45000,
    remainingAmount: 45000,
    status: 'pending',
    repayments: []
  },
  {
    id: 'D-203',
    customerId: 'c3',
    customerName: 'Yao Ibrahim',
    phone: '+225 01 99 88 77',
    boutiqueId: 'b2',
    saleId: 'V-0995',
    date: '2026-08-25T11:10:00Z',
    dueDate: '2026-08-30', // Overdue!
    originalAmount: 10000,
    remainingAmount: 10000,
    status: 'overdue',
    repayments: []
  }
];

export const INITIAL_EXPENSES = [
  {
    id: 'E-301',
    boutiqueId: 'b1',
    date: '2026-09-01T08:30:00Z',
    category: 'Transport',
    description: 'Livraison express cartons de charbon',
    amount: 5000,
    recordedBy: 'Mamadou Diallo'
  },
  {
    id: 'E-302',
    boutiqueId: 'b2',
    date: '2026-08-31T17:00:00Z',
    category: 'Électricité',
    description: 'Facture CIE climatisation boutique',
    amount: 18500,
    recordedBy: 'Aminata Touré'
  },
  {
    id: 'E-303',
    boutiqueId: 'b3',
    date: '2026-09-01T09:00:00Z',
    category: 'Fournitures',
    description: 'Achat sacs emballages et rouleaux tickets',
    amount: 7500,
    recordedBy: 'Kouassi Jean'
  }
];
