import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  Refrigerator, 
  Snowflake, 
  Plus, 
  Trash2, 
  LogOut, 
  LogIn,
  Milk,
  Apple,
  Beef,
  Fish,
  Carrot,
  Egg,
  IceCream,
  Pizza,
  Wine,
  Coffee,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './firebase';
import { FridgeItem, SectionType, ItemSize } from './types';
import { cn } from './lib/utils';

// --- Constants ---
const FREEZER_SHELVES = 2;
const FRIDGE_SHELVES = 4;
const GRID_WIDTH = 6;
const GRID_HEIGHT = 4;

const FOOD_ICONS = [
  { name: 'Milk', icon: Milk },
  { name: 'Apple', icon: Apple },
  { name: 'Beef', icon: Beef },
  { name: 'Fish', icon: Fish },
  { name: 'Carrot', icon: Carrot },
  { name: 'Egg', icon: Egg },
  { name: 'IceCream', icon: IceCream },
  { name: 'Pizza', icon: Pizza },
  { name: 'Wine', icon: Wine },
  { name: 'Coffee', icon: Coffee },
];

const SIZE_CONFIG: Record<ItemSize, { w: number; h: number }> = {
  small: { w: 1, h: 1 },
  medium: { w: 2, h: 1 },
  large: { w: 2, h: 2 },
};

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMsg(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-8 bg-red-50 text-red-800 rounded-lg border border-red-200 m-4">
        <h2 className="text-xl font-bold mb-2">오류가 발생했습니다</h2>
        <p className="font-mono text-sm">{errorMsg}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          새로고침
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionType>('fridge');
  const [selectedShelf, setSelectedShelf] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<FridgeItem>>({
    name: '',
    icon: 'Apple',
    size: 'small',
    section: 'fridge',
    shelfIndex: 0,
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase connection error: Client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  // Items Listener
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const q = query(collection(db, 'items'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FridgeItem));
      setItems(fetchedItems);
    }, (error) => {
      console.error('Firestore Error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const addItem = async (gridX: number, gridY: number) => {
    if (!user || !newItem.name) return;

    try {
      const itemData = {
        ...newItem,
        gridX,
        gridY,
        uid: user.uid,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'items'), itemData);
      setIsAdding(false);
      setNewItem({ ...newItem, name: '' });
    } catch (error) {
      console.error('Add Item Error:', error);
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
    } catch (error) {
      console.error('Remove Item Error:', error);
    }
  };

  const isCellOccupied = (section: SectionType, shelf: number, x: number, y: number) => {
    return items.some(item => {
      if (item.section !== section || item.shelfIndex !== shelf) return false;
      const { w, h } = SIZE_CONFIG[item.size];
      return (
        x >= item.gridX && x < item.gridX + w &&
        y >= item.gridY && y < item.gridY + h
      );
    });
  };

  const getOccupyingItem = (section: SectionType, shelf: number, x: number, y: number) => {
    return items.find(item => {
      if (item.section !== section || item.shelfIndex !== shelf) return false;
      const { w, h } = SIZE_CONFIG[item.size];
      return (
        x >= item.gridX && x < item.gridX + w &&
        y >= item.gridY && y < item.gridY + h
      );
    });
  };

  const canPlaceItem = (section: SectionType, shelf: number, x: number, y: number, size: ItemSize) => {
    const { w, h } = SIZE_CONFIG[size];
    if (x + w > GRID_WIDTH || y + h > GRID_HEIGHT) return false;

    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (isCellOccupied(section, shelf, x + i, y + j)) return false;
      }
    }
    return true;
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center">
          <Refrigerator className="w-12 h-12 text-zinc-300 mb-4" />
          <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-zinc-200/50 text-center border border-zinc-100"
        >
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-zinc-900/20">
            <Refrigerator className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Visual Fridge</h1>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            냉장고 속을 실제처럼 시각화하여<br />
            식재료를 스마트하게 관리하세요.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white py-4 px-6 rounded-2xl font-semibold hover:bg-zinc-800 transition-all active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            Google 계정으로 시작하기
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-bottom border-zinc-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              <Refrigerator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Visual Fridge</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Smart Inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-zinc-900">{user.displayName}</span>
              <span className="text-[10px] text-zinc-400">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Fridge Visualization */}
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="bg-white rounded-[40px] p-8 shadow-2xl shadow-zinc-200/50 border border-zinc-100 relative overflow-hidden">
              {/* Fridge Body */}
              <div className="max-w-md mx-auto relative">
                {/* Freezer Section */}
                <div 
                  className={cn(
                    "rounded-t-[32px] border-4 border-zinc-900 p-4 transition-all duration-500",
                    selectedSection === 'freezer' ? "bg-blue-50/50" : "bg-zinc-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <Snowflake className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Freezer</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(FREEZER_SHELVES)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedSection('freezer'); setSelectedShelf(i); }}
                          className={cn(
                            "w-8 h-2 rounded-full transition-all",
                            selectedSection === 'freezer' && selectedShelf === i ? "bg-zinc-900 w-12" : "bg-zinc-200"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="aspect-[4/3] bg-white rounded-2xl border-2 border-zinc-100 shadow-inner p-2 relative">
                    <ShelfGrid 
                      section="freezer" 
                      shelfIndex={selectedSection === 'freezer' ? selectedShelf : -1} 
                      items={items}
                      onCellClick={(x, y) => {
                        if (selectedSection === 'freezer') {
                          if (isAdding) addItem(x, y);
                        }
                      }}
                      onRemove={removeItem}
                      isAdding={isAdding && selectedSection === 'freezer'}
                      canPlace={(x, y) => canPlaceItem('freezer', selectedShelf, x, y, newItem.size as ItemSize)}
                    />
                  </div>
                </div>

                {/* Gap */}
                <div className="h-2 bg-zinc-900 mx-4"></div>

                {/* Fridge Section */}
                <div 
                  className={cn(
                    "rounded-b-[32px] border-4 border-zinc-900 p-4 transition-all duration-500",
                    selectedSection === 'fridge' ? "bg-emerald-50/50" : "bg-zinc-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <Refrigerator className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Fridge</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(FRIDGE_SHELVES)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedSection('fridge'); setSelectedShelf(i); }}
                          className={cn(
                            "w-8 h-2 rounded-full transition-all",
                            selectedSection === 'fridge' && selectedShelf === i ? "bg-zinc-900 w-12" : "bg-zinc-200"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="aspect-[4/5] bg-white rounded-2xl border-2 border-zinc-100 shadow-inner p-2 relative">
                    <ShelfGrid 
                      section="fridge" 
                      shelfIndex={selectedSection === 'fridge' ? selectedShelf : -1} 
                      items={items}
                      onCellClick={(x, y) => {
                        if (selectedSection === 'fridge') {
                          if (isAdding) addItem(x, y);
                        }
                      }}
                      onRemove={removeItem}
                      isAdding={isAdding && selectedSection === 'fridge'}
                      canPlace={(x, y) => canPlaceItem('fridge', selectedShelf, x, y, newItem.size as ItemSize)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls & Inventory */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Add Item Panel */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-zinc-200/30 border border-zinc-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  아이템 추가
                </h2>
                {isAdding && (
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!isAdding ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full py-8 border-2 border-dashed border-zinc-200 rounded-3xl text-zinc-400 hover:border-zinc-900 hover:text-zinc-900 transition-all flex flex-col items-center gap-2 group"
                >
                  <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-semibold">새로운 식재료 넣기</span>
                </button>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">Name</label>
                    <input 
                      type="text"
                      placeholder="식재료 이름 (예: 우유)"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full bg-zinc-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">Icon</label>
                    <div className="grid grid-cols-5 gap-2">
                      {FOOD_ICONS.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => setNewItem({ ...newItem, icon: item.name })}
                          className={cn(
                            "aspect-square rounded-xl flex items-center justify-center transition-all",
                            newItem.icon === item.name ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20" : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
                          )}
                        >
                          <item.icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2 block">Size</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as ItemSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setNewItem({ ...newItem, size })}
                          className={cn(
                            "py-2 rounded-xl text-xs font-bold capitalize transition-all",
                            newItem.size === size ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-900 text-white rounded-2xl">
                    <p className="text-xs font-medium text-zinc-400 mb-1">Placement Guide</p>
                    <p className="text-sm">냉장고 칸을 선택한 후, 원하는 위치를 클릭하세요.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Inventory List */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-zinc-200/30 border border-zinc-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Milk className="w-5 h-5" />
                전체 목록
              </h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <p className="text-sm">냉장고가 비어있습니다.</p>
                  </div>
                ) : (
                  items.map((item) => {
                    const IconComp = FOOD_ICONS.find(i => i.name === item.icon)?.icon || Apple;
                    return (
                      <div 
                        key={item.id}
                        className="group flex items-center justify-between p-4 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <IconComp className="w-5 h-5 text-zinc-900" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{item.name}</p>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                              {item.section} • Shelf {item.shelfIndex + 1}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

interface ShelfGridProps {
  section: SectionType;
  shelfIndex: number;
  items: FridgeItem[];
  onCellClick: (x: number, y: number) => void;
  onRemove: (id: string) => void;
  isAdding: boolean;
  canPlace: (x: number, y: number) => boolean;
}

const ShelfGrid: React.FC<ShelfGridProps> = ({ 
  section, 
  shelfIndex, 
  items, 
  onCellClick, 
  onRemove,
  isAdding,
  canPlace
}) => {
  const shelfItems = useMemo(() => 
    items.filter(item => item.section === section && item.shelfIndex === shelfIndex),
  [items, section, shelfIndex]);

  return (
    <div className="w-full h-full grid grid-cols-6 grid-rows-4 gap-1 relative">
      <div className="absolute -top-6 left-0 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
        {section} Shelf {shelfIndex + 1}
      </div>
      {/* Grid Background */}
      {[...Array(GRID_WIDTH * GRID_HEIGHT)].map((_, i) => {
        const x = i % GRID_WIDTH;
        const y = Math.floor(i / GRID_WIDTH);
        const isPlaceable = isAdding && canPlace(x, y);

        return (
          <div 
            key={i}
            onClick={() => isPlaceable && onCellClick(x, y)}
            className={cn(
              "rounded-md border border-zinc-50 transition-colors",
              isPlaceable ? "bg-zinc-100 cursor-pointer hover:bg-zinc-900/10" : "bg-transparent"
            )}
          />
        );
      })}

      {/* Items */}
      {shelfItems.map((item) => {
        const { w, h } = SIZE_CONFIG[item.size];
        const IconComp = FOOD_ICONS.find(i => i.name === item.icon)?.icon || Apple;
        
        return (
          <motion.div
            key={item.id}
            layoutId={item.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute p-1 group"
            style={{
              left: `${(item.gridX / GRID_WIDTH) * 100}%`,
              top: `${(item.gridY / GRID_HEIGHT) * 100}%`,
              width: `${(w / GRID_WIDTH) * 100}%`,
              height: `${(h / GRID_HEIGHT) * 100}%`,
            }}
          >
            <div className="w-full h-full bg-white rounded-xl shadow-md border border-zinc-100 flex flex-col items-center justify-center gap-1 relative overflow-hidden group-hover:border-zinc-900 transition-colors">
              <IconComp className={cn(
                "text-zinc-900",
                item.size === 'small' ? "w-5 h-5" : "w-8 h-8"
              )} />
              {item.size !== 'small' && (
                <span className="text-[8px] font-bold text-zinc-400 uppercase truncate px-1 max-w-full">
                  {item.name}
                </span>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="absolute top-1 right-1 p-1 bg-red-50 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default App;
