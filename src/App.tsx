/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocFromServer,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, differenceInDays, parseISO, isPast, isToday, addDays } from 'date-fns';
import { 
  Refrigerator, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  LogOut,
  LogIn,
  Search,
  Filter,
  Snowflake,
  ThermometerSnowflake,
  Utensils
} from 'lucide-react';
import { db, auth, signInWithGoogle, logout } from './firebase';
import { cn } from './lib/utils';

// --- Types ---
interface FoodItem {
  id: string;
  name: string;
  category: string;
  expiryDate: string;
  quantity?: number;
  unit?: string;
  location: 'fridge' | 'freezer';
  addedAt: string;
  uid: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Helper for Firestore Errors ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const ExpiryBadge = ({ date }: { date: string }) => {
  const expiryDate = parseISO(date);
  const daysLeft = differenceInDays(expiryDate, new Date());
  
  let colorClass = "bg-green-100 text-green-700 border-green-200";
  let icon = <CheckCircle2 className="w-3 h-3 mr-1" />;
  let text = `${daysLeft}일 남음`;

  if (isPast(expiryDate) && !isToday(expiryDate)) {
    colorClass = "bg-red-100 text-red-700 border-red-200";
    icon = <AlertCircle className="w-3 h-3 mr-1" />;
    text = "만료됨";
  } else if (daysLeft <= 3) {
    colorClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
    icon = <AlertCircle className="w-3 h-3 mr-1" />;
    text = daysLeft === 0 ? "오늘 만료" : `${daysLeft}일 남음`;
  }

  return (
    <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", colorClass)}>
      {icon}
      {text}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState<'all' | 'fridge' | 'freezer'>('all');

  // Form state
  const [newItem, setNewItem] = useState({
    name: '',
    category: '기타',
    expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    location: 'fridge' as 'fridge' | 'freezer',
    quantity: 1,
    unit: '개'
  });

  // --- Auth & Connection Test ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!isAuthReady || !user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'foodItems'),
      where('uid', '==', user.uid),
      orderBy('expiryDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: FoodItem[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as FoodItem);
      });
      setItems(itemsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foodItems');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // --- Actions ---
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'foodItems'), {
        ...newItem,
        uid: user.uid,
        addedAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewItem({
        name: '',
        category: '기타',
        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        location: 'fridge',
        quantity: 1,
        unit: '개'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'foodItems');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'foodItems', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `foodItems/${id}`);
    }
  };

  // --- Filtered Items ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLocation = filterLocation === 'all' || item.location === filterLocation;
      return matchesSearch && matchesLocation;
    });
  }, [items, searchTerm, filterLocation]);

  const fridgeItems = filteredItems.filter(i => i.location === 'fridge');
  const freezerItems = filteredItems.filter(i => i.location === 'freezer');

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Refrigerator className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">신선고</h1>
            <p className="text-slate-500 mb-8">냉장고 속 식재료를 스마트하게 관리하세요</p>
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Google 계정으로 시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Refrigerator className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">신선고</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user.displayName}님</span>
              <button onClick={logout} className="text-xs text-slate-500 hover:text-red-600 transition-colors">로그아웃</button>
            </div>
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-slate-200" alt="Profile" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="음식 이름 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setFilterLocation('all')}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", filterLocation === 'all' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50")}
            >
              전체
            </button>
            <button
              onClick={() => setFilterLocation('fridge')}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", filterLocation === 'fridge' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50")}
            >
              냉장
            </button>
            <button
              onClick={() => setFilterLocation('freezer')}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", filterLocation === 'freezer' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50")}
            >
              냉동
            </button>
          </div>
        </div>

        {/* Fridge Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Fridge Section */}
          {(filterLocation === 'all' || filterLocation === 'fridge') && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-2">
                <ThermometerSnowflake className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold">냉장실</h2>
                <span className="text-sm text-slate-400 font-normal ml-auto">{fridgeItems.length}개</span>
              </div>
              <div className="bg-white rounded-3xl border-4 border-slate-200 shadow-lg min-h-[400px] flex flex-col overflow-hidden">
                <div className="h-2 bg-slate-200 w-full mb-4 opacity-50"></div>
                <div className="flex-1 p-4 flex flex-col gap-3">
                  {fridgeItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50">
                      <Utensils className="w-12 h-12 mb-2" />
                      <p className="text-sm">냉장실이 비어있습니다</p>
                    </div>
                  ) : (
                    fridgeItems.map(item => (
                      <ItemCard key={item.id} item={item} onDelete={handleDeleteItem} />
                    ))
                  )}
                </div>
                <div className="h-2 bg-slate-200 w-full mt-4 opacity-50"></div>
              </div>
            </section>
          )}

          {/* Freezer Section */}
          {(filterLocation === 'all' || filterLocation === 'freezer') && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-2">
                <Snowflake className="w-5 h-5 text-cyan-500" />
                <h2 className="text-lg font-bold">냉동실</h2>
                <span className="text-sm text-slate-400 font-normal ml-auto">{freezerItems.length}개</span>
              </div>
              <div className="bg-white rounded-3xl border-4 border-cyan-100 shadow-lg min-h-[400px] flex flex-col overflow-hidden">
                <div className="h-2 bg-cyan-50 w-full mb-4 opacity-50"></div>
                <div className="flex-1 p-4 flex flex-col gap-3">
                  {freezerItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50">
                      <Snowflake className="w-12 h-12 mb-2" />
                      <p className="text-sm">냉동실이 비어있습니다</p>
                    </div>
                  ) : (
                    freezerItems.map(item => (
                      <ItemCard key={item.id} item={item} onDelete={handleDeleteItem} />
                    ))
                  )}
                </div>
                <div className="h-2 bg-cyan-50 w-full mt-4 opacity-50"></div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 hover:scale-110 transition-all flex items-center justify-center z-20"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold">음식 추가하기</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">음식 이름</label>
                <input
                  required
                  type="text"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  placeholder="예: 우유, 사과, 삼겹살"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">위치</label>
                  <select
                    value={newItem.location}
                    onChange={e => setNewItem({...newItem, location: e.target.value as 'fridge' | 'freezer'})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="fridge">냉장</option>
                    <option value="freezer">냉동</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">카테고리</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="기타">기타</option>
                    <option value="채소">채소</option>
                    <option value="과일">과일</option>
                    <option value="육류">육류</option>
                    <option value="수산물">수산물</option>
                    <option value="유제품">유제품</option>
                    <option value="음료">음료</option>
                    <option value="가공식품">가공식품</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">유통기한</label>
                <input
                  required
                  type="date"
                  value={newItem.expiryDate}
                  onChange={e => setNewItem({...newItem, expiryDate: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">수량</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">단위</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={e => setNewItem({...newItem, unit: e.target.value})}
                    placeholder="개, kg, ml 등"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 mt-4"
              >
                저장하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, onDelete }: { item: FoodItem, onDelete: (id: string) => void | Promise<void>, key?: string | number }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {item.category}
            </span>
            <h4 className="text-base font-bold text-slate-900 truncate">{item.name}</h4>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              <span>{item.expiryDate}</span>
            </div>
            {item.quantity && (
              <span className="text-xs font-medium text-slate-400">
                {item.quantity}{item.unit}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ExpiryBadge date={item.expiryDate} />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 z-10 animate-in fade-in duration-200">
          <p className="text-sm font-bold text-slate-900 mb-3">정말 삭제할까요?</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
