/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu as MenuIcon, X, Phone, MapPin, Instagram, Facebook, ShoppingCart, ChevronRight, ChevronLeft, Utensils, Info, LayoutDashboard, Plus, Minus, Edit2, Lock, Unlock, Search, LogOut, Share2, RefreshCw, Calendar, DollarSign, Coffee, MessageCircle, Download, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { cn } from './lib/utils';
import { MENU_ITEMS, CATEGORIES, CATEGORY_IMAGES, MENU_HERO_IMAGE, ABOUT_HERO_IMAGE, CHEF_IMAGE, HERO_VIDEO_POSTER, MenuItem, Language, CartItem } from './constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as htmlToImage from 'html-to-image';
import html2canvas from 'html2canvas';
import { auth, onAuthStateChanged, signOut, User, db } from './firebase';
import LoginPage from './LoginPage';
import AdminSetup from './AdminSetup';
import ReportPage from './ReportPage';
import { saveOrder } from './services/orderService';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp, addDoc, onSnapshot, limit } from 'firebase/firestore';

// --- Constants ---
const ADMIN_EMAIL = "armyprince7@gmail.com";
const RESTAURANT_PHONE = "966549569350";

// --- Context ---
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  isAdmin: false,
  login: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
});

const useAuth = () => useContext(AuthContext);

export const LanguageContext = createContext<{
  language: Language;
  lang: Language;
  setLanguage: (lang: Language) => void;
  t: any;
  translate: (name: { en: string; ar: string }) => string;
}>({
  language: 'en',
  lang: 'en',
  setLanguage: () => {},
  t: {},
  translate: (name) => name.en,
});

const CartContext = createContext<{
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
}>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
});

export const useLanguage = () => useContext(LanguageContext);
export const useCart = () => useContext(CartContext);

const translations = {
  en: {
    categories: {
      'Mutabbaq': 'Mutabbaq',
      'Meat': 'Meat',
      'Qalabat': 'Qalabat',
      'Falafel & Hummus': 'Falafel & Hummus',
      'Fava & Lentils': 'Fava & Lentils',
      'Areeka': 'Areeka',
      'Masoub': 'Masoub',
      'Bakery': 'Bakery',
      'Breakfast': 'Breakfast',
      'Sandwiches': 'Sandwiches',
      'Drinks': 'Drinks'
    },
    dashboard: {
      addNewItem: 'Add New Item',
      addOfflineOrder: 'Add Offline Order',
      salesReports: 'Sales Reports',
      totalOrders: 'Total Orders',
      online: 'Online',
      offline: 'Offline',
      totalRevenue: 'Total Revenue',
      orders: 'Orders',
      refreshing: 'Refreshing...',
      refresh: 'Refresh',
      menuManagement: 'Menu Management',
      orderManagement: 'Order Management',
      stats: 'Statistics',
      searchMenu: 'Search menu...',
      menuLocked: 'Unlock management to edit',
      menuUnlocked: 'Lock management',
      restoreDefaults: 'Restore Defaults',
      noOrders: 'No orders found',
      noItems: 'No menu items found'
    }
  },
  ar: {
    categories: {
      'Mutabbaq': 'مطبق',
      'Meat': 'لحوم',
      'Qalabat': 'قلابات',
      'Falafel & Hummus': 'طعمية وحمص',
      'Fava & Lentils': 'فول وعدس',
      'Areeka': 'عريكة',
      'Masoub': 'معصوب',
      'Bakery': 'مخبوزات',
      'Breakfast': 'فطور',
      'Sandwiches': 'ساندويتشات',
      'Drinks': 'مشروبات'
    },
    dashboard: {
      addNewItem: 'إضافة صنف جديد',
      addOfflineOrder: 'إضافة طلب محلي',
      salesReports: 'تقارير المبيعات',
      totalOrders: 'إجمالي الطلبات',
      online: 'أونلاين',
      offline: 'محلي',
      totalRevenue: 'إجمالي الإيرادات',
      orders: 'الطلبات',
      refreshing: 'جاري التحديث...',
      refresh: 'تحديث',
      menuManagement: 'إدارة المنيو',
      orderManagement: 'إدارة الطلبات',
      stats: 'الإحصائيات',
      searchMenu: 'البحث في المنيو...',
      menuLocked: 'افتح القفل للتعديل',
      menuUnlocked: 'قفل الإدارة',
      restoreDefaults: 'استعادة الافتراضي',
      noOrders: 'لا توجد طلبات',
      noItems: 'لا توجد أصناف في المنيو'
    }
  }
};

// --- SEO Helper ---
const useSEO = (title: string, description: string) => {
  useEffect(() => {
    document.title = `${title} | MUD Restaurant`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = description;
      document.head.appendChild(meta);
    }
  }, [title, description]);
};

// --- Components ---

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';

  const navLinks = [
    { name: language === 'en' ? 'Home' : 'الرئيسية', path: '/', icon: Utensils },
    { name: language === 'en' ? 'Menu' : 'المنيو', path: '/menu', icon: MenuIcon },
    { name: language === 'en' ? 'About' : 'عن المطعم', path: '/about', icon: Info },
    { name: language === 'en' ? 'Admin' : 'الإدارة', path: '/admin', icon: LayoutDashboard },
  ];

  const isHomePage = location.pathname === '/';
  const isSolid = scrolled || !isHomePage;

  return (
    <nav className={cn(
      "fixed top-0 left-0 w-full z-50 transition-all duration-500 px-6 py-4",
      isSolid ? "bg-mud-sand/90 backdrop-blur-md shadow-sm py-3" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-mud-earth rounded-full flex items-center justify-center text-white font-serif text-xl font-bold group-hover:scale-110 transition-transform">
            M
          </div>
          <span className={cn(
            "font-serif text-2xl font-bold tracking-tight transition-colors",
            isSolid ? "text-mud-earth" : "text-white"
          )}>MUD</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "text-sm font-medium uppercase tracking-widest transition-colors hover:text-mud-clay",
                location.pathname === link.path 
                  ? "text-mud-clay border-b border-mud-clay" 
                  : (isSolid ? "text-mud-ink" : "text-white/90")
              )}
            >
              {link.name}
            </Link>
          ))}
          
          {/* Language Toggle */}
          <button 
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className={cn(
              "text-xs font-bold uppercase tracking-widest border px-3 py-1 rounded-full transition-all",
              isSolid 
                ? "text-mud-earth border-mud-earth/20 hover:bg-mud-earth hover:text-white" 
                : "text-white border-white/30 hover:bg-white hover:text-mud-ink"
            )}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
          >
            {language === 'en' ? 'العربية' : 'English'}
          </button>

          {/* Cart Icon */}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))}
            className={cn(
              "relative p-2 transition-colors",
              isSolid ? "text-mud-ink hover:text-mud-clay" : "text-white hover:text-mud-gold"
            )}
            aria-label={isAr ? 'فتح حقيبة التسوق' : 'Open Shopping Cart'}
          >
            <ShoppingCart size={24} />
            <CartBadge />
          </button>

          <Link
            to="/menu"
            className={cn(
              "px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2",
              isSolid ? "bg-mud-earth text-white hover:bg-mud-clay" : "bg-white text-mud-ink hover:bg-mud-gold"
            )}
          >
            <Phone size={16} />
            {language === 'en' ? 'Order Now' : 'اطلب الآن'}
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button 
          className={cn(
            "md:hidden transition-colors",
            isSolid ? "text-mud-ink" : "text-white"
          )} 
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? (isAr ? 'إغلاق القائمة' : 'Close Menu') : (isAr ? 'فتح القائمة' : 'Open Menu')}
        >
          {isOpen ? <X size={28} /> : <MenuIcon size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-mud-sand shadow-xl border-t border-mud-earth/10 flex flex-col p-6 gap-4 md:hidden"
            dir={isAr ? "rtl" : "ltr"}
          >
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-4 text-lg font-serif py-2 border-b border-mud-earth/5",
                  isAr && "flex-row-reverse"
                )}
              >
                <link.icon size={20} className="text-mud-clay" />
                {link.name}
              </Link>
            ))}
            
            {/* Mobile Language Toggle */}
            <button 
              onClick={() => {
                setLanguage(language === 'en' ? 'ar' : 'en');
                setIsOpen(false);
              }}
              className="flex items-center gap-4 text-lg font-serif py-2 border-b border-mud-earth/5 text-mud-earth"
            >
              <div className="w-5 h-5 flex items-center justify-center">🌐</div>
              {language === 'en' ? 'العربية' : 'English'}
            </button>

            <Link
              to="/menu"
              onClick={() => setIsOpen(false)}
              className="bg-mud-earth text-white p-4 rounded-xl text-center font-bold uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
            >
              <Phone size={20} />
              {isAr ? 'اطلب الآن' : 'Order Now'}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <footer className={cn("bg-mud-ink text-mud-sand py-12 px-6", isAr && "text-right")} dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-6">
          <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
            <div className="w-8 h-8 bg-mud-gold rounded-full flex items-center justify-center text-mud-ink font-serif text-lg font-bold">M</div>
            <span className="font-serif text-2xl font-bold tracking-tight text-mud-gold">MUD</span>
          </div>
          <p className="text-mud-sand/60 text-sm leading-relaxed">
            {isAr 
              ? 'نقدم لكم المذاق الأصيل لليمن وشبه الجزيرة العربية على مائدتكم. جرب التراث في كل لقمة.'
              : 'Bringing the authentic taste of Yemen and the Arabian Peninsula to your table. Experience tradition in every bite.'}
          </p>
          <div className={cn("flex gap-4", isAr && "flex-row-reverse")}>
            <Instagram className="text-mud-gold hover:text-white cursor-pointer transition-colors" size={20} />
            <Facebook className="text-mud-gold hover:text-white cursor-pointer transition-colors" size={20} />
          </div>
        </div>
        
        <div>
          <h4 className="font-serif text-xl mb-6 text-mud-gold italic">{isAr ? 'روابط سريعة' : 'Quick Links'}</h4>
          <ul className="space-y-3 text-sm text-mud-sand/70">
            <li><Link to="/" className="hover:text-mud-gold transition-colors">{isAr ? 'الرئيسية' : 'Home'}</Link></li>
            <li><Link to="/menu" className="hover:text-mud-gold transition-colors">{isAr ? 'المنيو' : 'Our Menu'}</Link></li>
            <li><Link to="/about" className="hover:text-mud-gold transition-colors">{isAr ? 'قصتنا' : 'Our Story'}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif text-xl mb-6 text-mud-gold italic">{isAr ? 'اتصل بنا' : 'Contact'}</h4>
          <ul className="space-y-3 text-sm text-mud-sand/70">
            <li className="flex items-center gap-2">
              <MapPin size={16} className="text-mud-gold" /> 
              {isAr ? 'مربع 23، الجامعة الإسلامية بالمدينة المنورة' : 'Block 23, Islamic University of Madinah'}
            </li>
            <li className="flex items-center gap-2">
              <Phone size={16} className="text-mud-gold" /> 
              +966549569350
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-serif text-xl mb-6 text-mud-gold italic">{isAr ? 'ساعات العمل' : 'Hours'}</h4>
          <ul className="space-y-3 text-sm text-mud-sand/70">
            <li>{isAr ? 'الاثنين - الجمعة: 11:00 ص - 11:00 م' : 'Mon - Fri: 11:00 AM - 11:00 PM'}</li>
            <li>{isAr ? 'السبت - الأحد: 08:00 ص - 12:00 ص' : 'Sat - Sun: 08:00 AM - 12:00 AM'}</li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/10 text-center text-xs text-mud-sand/40 uppercase tracking-widest">
        {isAr ? '© 2026 مطعم مُد. جميع الحقوق محفوظة.' : '© 2026 Mud Restaurant. All Rights Reserved.'}
      </div>
    </footer>
  );
};

// --- Pages ---

const Home = () => {
  const { language, translate } = useLanguage();
  const isAr = language === 'ar';

  useSEO(
    isAr ? 'مطعم مُد - المذاق العربي الأصيل' : 'MUD Restaurant - Authentic Arabian Taste',
    isAr 
      ? 'استمتع بأفضل المأكولات اليمنية والعربية في مطعم مُد. مطبخنا يقدم المذاق الأصيل والضيافة التقليدية.' 
      : 'Experience the finest Yemeni and Arabian cuisine at MUD Restaurant. Our kitchen brings authentic taste and traditional hospitality.'
  );

  const stats = [
    { number: '15+', label: isAr ? 'سنوات من الخبرة' : 'Years of Tradition' },
    { number: '50+', label: isAr ? 'طبق أصيل' : 'Authentic Dishes' },
    { number: '10k+', label: isAr ? 'عميل سعيد' : 'Happy Customers' },
    { number: '4.9', label: isAr ? 'تقييم العملاء' : 'Customer Rating' },
  ];

  const featuredDishes = [
    {
      id: '1',
      name: { en: 'Traditional Shakshuka', ar: 'شكشوكة تقليدية' },
      description: { en: 'Perfectly poached eggs in a savory tomato and pepper sauce.', ar: 'بيض مسلوق بإتقان في صلصة طماطم وفلفل لذيذة.' },
      image: 'https://images.pexels.com/photos/29177376/pexels-photo-29177376.jpeg',
      price: '12'
    },
    {
      id: '2',
      name: { en: 'Classic Sandwich', ar: 'ساندويتش كلاسيكي' },
      description: { en: 'Freshly prepared sandwich with premium fillings and crisp vegetables.', ar: 'ساندويتش مُعد طازجاً مع حشوات فاخرة وخضروات مقرمشة.' },
      image: 'https://media.istockphoto.com/id/1400980767/photo/ham-sandwich-with-cheese-lettuce-and-tomato.jpg?b=1&s=612x612&w=0&k=20&c=UKgVkjyFqZJN7VWyA4yxZBIJ335KLo7wJo9bNV-bvGw=',
      price: '10'
    },
    {
      id: '3',
      name: { en: 'Aromatic Tea', ar: 'شاي عطري' },
      description: { en: 'Traditional brewed tea with a blend of aromatic spices.', ar: 'شاي مخمر تقليدي مع مزيج من التوابل العطرية.' },
      image: 'https://images.pexels.com/photos/11830227/pexels-photo-11830227.jpeg',
      price: '5'
    }
  ];

  const testimonials = [
    {
      name: isAr ? 'أحمد العتيبي' : 'Ahmed Al-Otaibi',
      text: isAr ? 'أفضل مندي تذوقته في حياتي. المندي واللحم مطهو بإتقان.' : 'The best Mandi I have ever tasted. The Mandi and meat are cooked to perfection.',
      rating: 5
    },
    {
      name: isAr ? 'عمر الحربي' : 'Omar Al-Harbi',
      text: isAr ? 'المعصوب الملكي والمطبق عندهم لا يعلى عليه! أنصح بتجربة المطبق المالح.' : 'Their Premium Masoub and Mutabbaq are second to none! I recommend trying the savory Mutabbaq.',
      rating: 5
    }
  ];

  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let player: any;
    const initPlayer = () => {
      if (!(window as any).YT) return;
      player = new (window as any).YT.Player('hero-video', {
        events: {
          'onReady': (event: any) => {
            setVideoReady(true);
            event.target.mute();
            event.target.playVideo();
          },
          'onStateChange': (event: any) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              player.playVideo();
            }
          }
        }
      });
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      if (player && player.destroy) {
        player.destroy();
      }
    };
  }, []);

  return (
    <main className={cn("relative", isAr && "text-right")} dir={isAr ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={HERO_VIDEO_POSTER}
            className="w-full h-full object-cover scale-[1.1]"
            onCanPlay={() => setVideoReady(true)}
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-in-a-professional-kitchen-40530-large.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-mud-ink/90 via-mud-ink/40 to-mud-ink/90" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8 pt-28 md:pt-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <span className="text-mud-gold font-serif italic text-xl md:text-2xl tracking-wide block">
              {isAr ? 'مرحباً بكم في مطعم مُد' : 'Welcome to Mud Restaurant'}
            </span>
            <h1 className="text-5xl md:text-8xl font-bold text-white tracking-tighter leading-none uppercase font-serif">
              {isAr ? (
                <>أصالة <br /> <span className="text-mud-gold italic">المذاق العربي واليمني</span></>
              ) : (
                <>Authentic <br /> <span className="text-mud-gold italic">Arabian & Yemeni</span> <br /> Cuisine</>
              )}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-mud-sand/80 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed text-balance"
          >
            {isAr 
              ? 'استمتع بالتراث الغني للنكهات اليمنية والضيافة العربية التقليدية في أجواء عصرية فاخرة.'
              : 'Experience the rich heritage of Yemeni flavors and traditional Arabian hospitality in a modern, premium setting.'}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Link 
              to="/menu" 
              className="w-full sm:w-auto bg-mud-gold text-mud-ink px-10 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 group"
            >
              {isAr ? 'استكشف المنيو' : 'Explore Menu'}
              <ChevronRight size={18} className={cn("transition-transform", isAr ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1")} />
            </Link>
            <Link 
              to="/menu"
              className="w-full sm:w-auto border border-white/30 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Phone size={18} />
              {isAr ? 'اطلب الآن' : 'Order Now'}
            </Link>
          </motion.div>
        </div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40"
        >
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent mx-auto" />
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-mud-ink text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="space-y-2"
              >
                <div className="text-4xl md:text-5xl font-serif font-bold text-mud-gold italic">{stat.number}</div>
                <div className="text-xs uppercase tracking-[0.3em] text-mud-sand/40 font-bold">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Dishes Section */}
      <section className="py-32 px-6 bg-mud-sand/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="space-y-4 max-w-xl">
              <span className="text-mud-clay font-serif italic text-xl block">{isAr ? 'أطباقنا المميزة' : 'Chef\'s Selection'}</span>
              <h2 className="text-4xl md:text-6xl font-bold text-mud-ink uppercase tracking-tighter leading-none">
                {isAr ? 'تذوق التراث' : 'Taste the Tradition'}
              </h2>
            </div>
            <Link to="/menu" className="text-mud-earth font-bold uppercase tracking-widest text-sm hover:underline flex items-center gap-2">
              {isAr ? 'عرض القائمة الكاملة' : 'View Full Menu'} <ChevronRight size={16} className={cn(isAr && "rotate-180")} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredDishes.map((dish, idx) => (
              <motion.div
                key={dish.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="bg-white rounded-[40px] overflow-hidden shadow-xl shadow-mud-ink/5 border border-mud-earth/5 group"
              >
                <div className="h-64 overflow-hidden relative">
                  <img 
                    src={dish.image} 
                    alt={`${translate(dish.name)} - Authentic Yemeni Dish`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full font-bold text-mud-earth shadow-lg">
                    {dish.price} SAR
                  </div>
                </div>
                <div className="p-8 space-y-4 text-center">
                  <h3 className="text-2xl font-serif font-bold italic text-mud-ink">{translate(dish.name)}</h3>
                  <p className="text-mud-ink/60 text-sm leading-relaxed">{translate(dish.description)}</p>
                  <Link 
                    to="/menu" 
                    className="inline-flex items-center gap-2 text-mud-clay font-bold uppercase tracking-widest text-[10px] hover:text-mud-earth transition-colors"
                  >
                    {isAr ? 'اطلب الآن' : 'Order Now'} <ChevronRight size={14} className={cn(isAr && "rotate-180")} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section className="py-32 px-6 bg-white overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="text-mud-clay font-serif italic text-xl block">{isAr ? 'الأجواء' : 'The Atmosphere'}</span>
              <h2 className="text-4xl md:text-6xl font-bold text-mud-ink uppercase tracking-tighter leading-none">
                {isAr ? 'أكثر من مجرد وجبة' : 'More Than Just a Meal'}
              </h2>
            </div>
            <p className="text-mud-ink/70 text-lg leading-relaxed max-w-2xl mx-auto">
              {isAr 
                ? 'في مُد، نؤمن بأن تناول الطعام هو طقس اجتماعي. لقد صممنا مساحتنا لتعكس دفء الضيافة العربية، مع لمسات عصرية تجعل كل زيارة مناسبة خاصة.'
                : 'At MUD, we believe dining is a social ritual. We have designed our space to reflect the warmth of Arabian hospitality, with modern touches that make every visit a special occasion.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 max-w-2xl mx-auto">
              <div className="space-y-4 p-8 bg-mud-sand/20 rounded-[40px] border border-mud-earth/5">
                <div className="w-12 h-12 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth mx-auto">
                  <Utensils size={24} />
                </div>
                <h4 className="font-bold text-mud-ink text-xl">{isAr ? 'مكونات طازجة' : 'Fresh Ingredients'}</h4>
                <p className="text-sm text-mud-ink/60">{isAr ? 'نستخدم أفضل المكونات المحلية والمستوردة لضمان الجودة.' : 'We use the finest local and imported ingredients to ensure quality.'}</p>
              </div>
              <div className="space-y-4 p-8 bg-mud-sand/20 rounded-[40px] border border-mud-earth/5">
                <div className="w-12 h-12 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth mx-auto">
                  <Info size={24} />
                </div>
                <h4 className="font-bold text-mud-ink text-xl">{isAr ? 'خدمة متميزة' : 'Premium Service'}</h4>
                <p className="text-sm text-mud-ink/60">{isAr ? 'فريقنا مكرس لراحتكم وسعادتكم في كل لحظة.' : 'Our team is dedicated to your comfort and happiness at every moment.'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 px-6 bg-mud-ink text-white">
        <div className="max-w-4xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <span className="text-mud-gold font-serif italic text-xl block">{isAr ? 'آراء العملاء' : 'Guest Reviews'}</span>
            <h2 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none">
              {isAr ? 'ماذا يقولون عنا' : 'What They Say'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {testimonials.map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-white/5 backdrop-blur-sm p-10 rounded-[40px] border border-white/10 space-y-6 text-left"
                dir="ltr"
              >
                <div className="flex gap-1 text-mud-gold">
                  {[...Array(t.rating)].map((_, i) => <span key={i}>★</span>)}
                </div>
                <p className="text-mud-sand/80 italic font-serif text-lg leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-mud-gold rounded-full flex items-center justify-center text-mud-ink font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-mud-sand">{t.name}</h4>
                    <p className="text-[10px] uppercase tracking-widest text-mud-sand/40">Verified Guest</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Info Section */}
      <section className="py-32 px-6 bg-white border-t border-mud-earth/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-6 text-center md:text-left">
            <div className="w-16 h-16 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth mx-auto md:mx-0">
              <MapPin size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-bold italic">{isAr ? 'موقعنا' : 'Our Location'}</h3>
              <p className="text-mud-ink/60 leading-relaxed">
                {isAr ? '123 طريق التراث، مدينة الطعام،' : '123 Heritage Way, Food City,'} <br /> 
                {isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia'}
              </p>
              <a 
                href="https://urldra.cloud.huawei.com/zS3yBcW1Us" 
                target="_blank" 
                rel="noopener noreferrer"
                className={cn("inline-flex items-center gap-2 text-mud-clay font-bold uppercase tracking-widest text-sm hover:text-mud-earth transition-colors pt-2", isAr && "flex-row-reverse")}
              >
                {isAr ? 'احصل على الاتجاهات' : 'Get Directions'} <ChevronRight size={16} className={cn(isAr && "rotate-180")} />
              </a>
            </div>
          </div>

          <div className="space-y-6 text-center md:text-left">
            <div className="w-16 h-16 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth mx-auto md:mx-0">
              <Phone size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-bold italic">{isAr ? 'اتصل بنا' : 'Contact Us'}</h3>
              <p className="text-mud-ink/60 leading-relaxed">
                {isAr ? 'للحجوزات أو الاستفسارات،' : 'For reservations or inquiries,'} <br /> 
                {isAr ? 'اتصل بنا مباشرة.' : 'call us directly.'}
              </p>
              <a 
                href="tel:+1234567890" 
                className="text-xl font-bold text-mud-earth block pt-2"
              >
                +1 234 567 890
              </a>
            </div>
          </div>

          <div className="space-y-6 text-center md:text-left">
            <div className="w-16 h-16 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth mx-auto md:mx-0">
              <Utensils size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-bold italic">{isAr ? 'ساعات العمل' : 'Working Hours'}</h3>
              <div className="text-mud-ink/60 space-y-1">
                <p className={cn("flex justify-between md:justify-start md:gap-4", isAr && "flex-row-reverse")}>
                  <span className="font-bold w-24">{isAr ? 'الاثنين - الجمعة:' : 'Mon - Fri:'}</span> 
                  <span>11:00 AM - 11:00 PM</span>
                </p>
                <p className={cn("flex justify-between md:justify-start md:gap-4", isAr && "flex-row-reverse")}>
                  <span className="font-bold w-24">{isAr ? 'السبت - الأحد:' : 'Sat - Sun:'}</span> 
                  <span>08:00 AM - 12:00 AM</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const Menu = () => {
  const { t, lang, translate } = useContext(LanguageContext);
  const { addToCart } = useContext(CartContext);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const loadItems = async () => {
      const storedItems = await dbGetAll('menu_items');
      if (storedItems && storedItems.length > 0) {
        setItems(storedItems);
      } else {
        setItems(MENU_ITEMS);
      }
    };
    loadItems();
    
    // Simple polling for updates from Admin Panel
    const interval = setInterval(loadItems, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = (item: MenuItem) => {
    addToCart(item);
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 2000);
  };

  const groupedItems = useMemo(() => {
    const categoryItems = items.filter(item => item.category === activeCategory);
    const groups: { [key: string]: { baseName: { en: string, ar: string }, variants: MenuItem[], image?: string } } = {};
    
    categoryItems.forEach(item => {
      const enBase = item.name.en.split(' (')[0];
      const arBase = item.name.ar.split(' (')[0];
      const key = enBase;
      
      if (!groups[key]) {
        groups[key] = {
          baseName: { en: enBase, ar: arBase },
          variants: [],
          image: item.image
        };
      }
      groups[key].variants.push(item);
    });
    
    return Object.values(groups);
  }, [activeCategory, items]);

  return (
    <div className="bg-mud-sand min-h-screen">
      {/* Menu Hero Section */}
      <section className="relative h-[40vh] md:h-[50vh] overflow-hidden">
        <img 
          src={MENU_HERO_IMAGE} 
          alt="Menu Hero" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <span className="text-mud-gold font-serif italic text-xl md:text-2xl tracking-wide block">
              {lang === 'en' ? 'Discover Our Flavors' : 'اكتشف نكهاتنا'}
            </span>
            <h1 className="text-5xl md:text-8xl font-bold text-white tracking-tighter leading-none uppercase font-serif">
              {lang === 'en' ? 'Our Menu' : 'قائمة الطعام'}
            </h1>
          </motion.div>
        </div>
      </section>

      <section id="menu" className="py-24 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">

        {/* Category Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase transition-all border",
                activeCategory === cat 
                  ? "bg-mud-earth text-white border-mud-earth shadow-lg scale-105" 
                  : "bg-white text-mud-ink/60 border-mud-earth/10 hover:border-mud-earth/30"
              )}
            >
              {t.categories?.[cat] || cat}
            </button>
          ))}
        </div>

        {/* Menu Items Container */}
        <div className="max-w-full bg-white rounded-[60px] py-16 px-4 md:px-10 relative overflow-hidden shadow-sm border border-mud-earth/5">
          {/* Category Heading Image */}
          <div className="relative h-72 md:h-[500px] mb-16 rounded-[40px] overflow-hidden shadow-2xl group/header">
            <img 
              src={CATEGORY_IMAGES[activeCategory]} 
              alt={`${activeCategory} Category - Mud Restaurant Menu`}
              className="w-full h-full transition-transform duration-1000 object-cover group-hover/header:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-mud-ink/90 via-mud-ink/30 to-transparent flex items-end p-8 md:p-16">
              <div className="space-y-2">
                <span className="text-mud-gold font-serif italic text-xl md:text-2xl block">
                  {t.categories?.[activeCategory] || activeCategory}
                </span>
                <h2 className="text-4xl md:text-6xl font-serif text-white tracking-tighter italic">
                  {lang === 'en' ? activeCategory : t.categories?.[activeCategory]}
                </h2>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-10 left-10 w-64 h-64 border border-mud-earth/5 rounded-[40px] rotate-45 pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 border border-mud-earth/5 rounded-[60px] -rotate-12 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-wrap justify-center gap-6">
              <AnimatePresence mode="wait">
                {groupedItems.map((group, idx) => (
                  <motion.div
                    key={group.baseName.en}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, delay: idx * 0.03 }}
                    className={cn(
                      "w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] bg-mud-sand/30 backdrop-blur-sm rounded-[30px] overflow-hidden border border-mud-earth/5 flex flex-col group hover:bg-mud-sand/50 transition-all duration-300",
                      activeCategory === 'Drinks' && "md:w-[calc(33.333%-16px)]"
                    )}
                  >
                    <div className="p-6 md:p-8 flex flex-col flex-grow">
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 bg-mud-gold rounded-sm" />
                          <span className="text-[9px] font-bold text-mud-ink/30 tracking-widest uppercase">
                            {activeCategory}
                          </span>
                          {group.variants.some(v => v.isPopular) && (
                            <span className="ml-auto bg-mud-gold/20 text-mud-gold text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                              {lang === 'en' ? 'Popular' : 'شائع'}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold italic text-mud-ink mb-1 leading-tight">
                          {group.baseName.en}
                        </h3>
                        <p className="text-base font-arabic text-mud-ink/80 text-right pr-4 mb-2">
                          {group.baseName.ar}
                        </p>
                        {group.variants[0].description && (
                          <p className="text-xs text-mud-ink/50 leading-relaxed italic border-l-2 border-mud-gold/30 pl-3 mt-2">
                            {translate(group.variants[0].description)}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-4 mt-auto">
                        {group.variants.map((variant) => {
                          const sizeLabel = variant.name.en.match(/\((.*?)\)/)?.[1] || 'Standard';
                          const sizeLabelAr = variant.name.ar.match(/\((.*?)\)/)?.[1] || 'عادي';
                          
                          return (
                            <div key={variant.id} className="flex justify-between items-center border-t border-mud-earth/5 pt-4 group/variant">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-mud-ink uppercase tracking-widest group-hover/variant:text-mud-clay transition-colors">{sizeLabel}</span>
                                <span className="text-[11px] font-arabic text-mud-ink/60">{sizeLabelAr}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className="bg-mud-sand px-4 py-1 rounded-full flex items-center gap-2 border border-mud-earth/10">
                                  <span className="text-base font-bold text-mud-earth">{variant.price}</span>
                                  <span className="text-[8px] font-bold text-mud-ink/40 uppercase tracking-widest">SAR</span>
                                </div>
                                
                                <button 
                                  onClick={() => handleAddToCart(variant)}
                                  className={cn(
                                    "w-10 h-10 border rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
                                    addedId === variant.id 
                                      ? "bg-green-500 text-white border-green-500" 
                                      : "text-mud-earth border-mud-earth/10 hover:bg-mud-earth hover:text-white hover:border-mud-earth"
                                  )}
                                >
                                  {addedId === variant.id ? <div className="text-[10px] font-bold">✓</div> : <Plus size={20} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  );
};

const About = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const values = [
    {
      title: isAr ? 'الأصالة' : 'Authenticity',
      desc: isAr ? 'نلتزم بالوصفات التقليدية والمكونات الأصلية.' : 'We stay true to traditional recipes and original ingredients.',
      icon: Utensils
    },
    {
      title: isAr ? 'الجودة' : 'Quality',
      desc: isAr ? 'نختار أفضل المكونات الطازجة يومياً.' : 'We select the finest fresh ingredients daily.',
      icon: Info
    },
    {
      title: isAr ? 'الضيافة' : 'Hospitality',
      desc: isAr ? 'نرحب بضيوفنا بكرم الضيافة العربية الأصيلة.' : 'We welcome our guests with authentic Arabian generosity.',
      icon: Phone
    }
  ];

  return (
    <div className={cn("pt-32 pb-32 px-6 bg-mud-sand/30", isAr && "text-right")} dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto space-y-32">
        {/* Story Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="text-mud-clay font-serif italic text-xl block">{isAr ? 'قصتنا' : 'Our Story'}</span>
              <h1 className="text-5xl md:text-7xl font-bold text-mud-ink uppercase tracking-tighter leading-none font-serif">
                {isAr ? <>جوهر <br /> <span className="text-mud-gold italic">مُد</span></> : <>The Essence <br /> of <span className="text-mud-gold italic">Mud</span></>}
              </h1>
            </div>
            <div className="space-y-6 text-mud-ink/70 text-lg leading-relaxed font-light">
              <p>
                {isAr 
                  ? 'تأسس مطعم مُد في عام 2010، وبدأ كمطبخ عائلي صغير بمهمة واحدة: مشاركة النكهات الروحية والترابية للمطبخ اليمني مع العالم. يشير اسم "مُد" إلى العمارة التقليدية المبنية من الطوب اللبن في شبام، "مانهاتن الصحراء"، مما يعكس التزامنا بالأسس المتينة والتقاليد العريقة.'
                  : 'Founded in 2010, Mud Restaurant began as a small family kitchen with a single mission: to share the soulful, earthy flavors of Yemeni cuisine with the world. The name "Mud" pays homage to the traditional mud-brick architecture of Shibam, the "Manhattan of the Desert," reflecting our commitment to solid foundations and ancient traditions.'}
              </p>
              <p>
                {isAr 
                  ? 'يتم اختيار كل مكون بعناية، من عسل وادي حضرموت إلى توابل أسواق عدن. مطبخنا هو مكان يتباطأ فيه الوقت، وتترك النكهات لتتطور بشكل طبيعي، تماماً كما كانت لقرون.'
                  : 'Every ingredient is carefully sourced, from the honey of the Hadramaut valley to the spices of the Aden markets. Our kitchen is a place where time slows down, and flavors are allowed to develop naturally, just as they have for centuries.'}
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-[60px] overflow-hidden border-8 border-white shadow-2xl">
              <img 
                src={CHEF_IMAGE} 
                alt="Chef at work" 
                className="w-full h-full object-cover scale-110 hover:scale-100 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className={cn("absolute -bottom-10 -right-10 w-48 h-48 bg-mud-clay rounded-full flex flex-col items-center justify-center text-white font-bold text-center p-6 shadow-2xl border-8 border-white", isAr && "-right-auto -left-10")}>
              <span className="text-4xl font-serif italic">15+</span>
              <span className="text-[10px] uppercase tracking-widest">{isAr ? 'عاماً من التميز' : 'Years of Excellence'}</span>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="space-y-16">
          <div className="text-center space-y-4">
            <span className="text-mud-clay font-serif italic text-xl">{isAr ? 'قيمنا' : 'Our Values'}</span>
            <h2 className="text-4xl md:text-6xl font-bold text-mud-ink uppercase tracking-tighter">{isAr ? 'ما نؤمن به' : 'What We Believe In'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <div key={i} className="bg-white p-12 rounded-[40px] shadow-sm border border-mud-earth/5 space-y-6 hover:shadow-xl transition-shadow group">
                <div className="w-16 h-16 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-earth group-hover:bg-mud-earth group-hover:text-white transition-colors">
                  <v.icon size={32} />
                </div>
                <h3 className="text-2xl font-serif font-bold italic text-mud-ink">{v.title}</h3>
                <p className="text-mud-ink/60 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- IndexedDB Utility ---
const DB_NAME = 'RestaurantAdminDB';
const DB_VERSION = 4;

let dbInstance: IDBDatabase | null = null;
const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev: any) => {
      const d = ev.target.result;
      if (!d.objectStoreNames.contains('config')) d.createObjectStore('config');
      if (!d.objectStoreNames.contains('orders')) d.createObjectStore('orders', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('archive')) d.createObjectStore('archive', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('menu_items')) d.createObjectStore('menu_items', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('cleared_ids')) d.createObjectStore('cleared_ids');
    };
    req.onsuccess = (ev: any) => {
      dbInstance = ev.target.result;
      resolve(ev.target.result);
    };
    req.onerror = (ev: any) => reject(ev.target.error);
  });
};

const dbGet = async (store: string, key: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
};

const dbPut = async (store: string, key: string | null, value: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    const req = (['config', 'cleared_ids'].includes(store) && key) ? os.put(value, key) : os.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
};

const dbDelete = async (store: string, key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
};

const dbGetAll = async (store: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
};

const AdminDashboard = () => {
  const { translate, t, language } = useLanguage();
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('orders');
  
  // Menu Management State
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [newItem, setNewItem] = useState({ nameEn: '', nameAr: '', category: CATEGORIES[0], price: '' });
  const [menuSearch, setMenuSearch] = useState('');
  const [isMenuLocked, setIsMenuLocked] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' }>({
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  // Order Management State
  const [orders, setOrders] = useState<any[]>([]);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({ items: '', amount: '', date: '' });
  const [confirmationMessage, setConfirmationMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { logout } = useAuth();

  useEffect(() => {
    const init = async () => {
      // Load Menu Items from IndexedDB or fallback to constants
      const storedItems = await dbGetAll('menu_items');
      if (storedItems && storedItems.length > 0) {
        setItems(storedItems);
      } else {
        setItems(MENU_ITEMS);
        // Save initial items to IndexedDB
        for (const item of MENU_ITEMS) {
          await dbPut('menu_items', null, item);
        }
      }
    };
    init();

    // Real-time orders listener with limit for performance
    const q = query(collection(db, "orders"), orderBy("date", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const firestoreOrders = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: (d.data().date as Timestamp).toDate().toISOString()
      }));
      setOrders(firestoreOrders);
    }, (error) => {
      console.error("Orders listener error:", error);
    });

    return () => unsubscribe();
  }, []);

  const loadOrders = async (showToast = false) => {
    // Manual refresh still available if needed, though onSnapshot handles it
    if (showToast) {
      setConfirmationMessage({ text: 'Orders are updated in real-time!', type: 'success' });
      setTimeout(() => setConfirmationMessage(null), 3000);
    }
  };

  const orderStats = useMemo(() => {
    return {
      total: orders.length,
      online: orders.filter(o => o.source?.toLowerCase() === 'online').length,
      offline: orders.filter(o => o.source?.toLowerCase() === 'offline').length,
      revenue: orders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0)
    };
  }, [orders]);

  const filteredMenuItems = useMemo(() => {
    return items.filter(item => 
      item.name.en.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.name.ar.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(menuSearch.toLowerCase())
    );
  }, [items, menuSearch]);

  const menuStats = useMemo(() => {
    return {
      total: items.length,
      categories: new Set(items.map(i => i.category)).size,
      avgPrice: (items.reduce((sum, i) => sum + i.price, 0) / items.length).toFixed(2)
    };
  }, [items]);

  // CRUD Actions
  const restoreDefaultMenu = async () => {
    if (!confirm(isAr ? 'هل أنت متأكد من استعادة المنيو الافتراضي؟ ستفقد جميع التعديلات الحالية.' : 'Restore default menu? All custom items will be lost.')) return;
    const allItems = await dbGetAll('menu_items');
    for (const item of allItems) {
      await dbDelete('menu_items', item.id);
    }
    for (const item of MENU_ITEMS) {
      await dbPut('menu_items', null, item);
    }
    setItems(MENU_ITEMS);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.nameEn || !newItem.nameAr || !newItem.price) return;
    
    const item: MenuItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: {
        en: newItem.nameEn,
        ar: newItem.nameAr
      },
      category: newItem.category,
      price: parseFloat(newItem.price)
    };
    
    const updatedItems = [item, ...items];
    setItems(updatedItems);
    await dbPut('menu_items', null, item);
    setNewItem({ nameEn: '', nameAr: '', category: CATEGORIES[0], price: '' });
    setIsMenuModalOpen(false);
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenuItem) return;
    
    const updatedItems = items.map(i => i.id === editingMenuItem.id ? editingMenuItem : i);
    setItems(updatedItems);
    await dbPut('menu_items', null, editingMenuItem);
    setIsEditMenuModalOpen(false);
    setEditingMenuItem(null);
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({
      title: isAr ? 'حذف صنف' : 'Delete Menu Item',
      message: isAr ? 'هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this menu item? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        setItems(items.filter(item => item.id !== id));
        await dbDelete('menu_items', id);
        setConfirmationMessage({ text: isAr ? 'تم حذف الصنف بنجاح!' : 'Menu item deleted successfully!', type: 'success' });
        setTimeout(() => setConfirmationMessage(null), 3000);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddingOrder) return;
    setIsAddingOrder(true);
    try {
      const orderId = Math.floor(1000 + Math.random() * 9000).toString();
      const orderData = {
        orderId: orderId,
        items: newOrder.items,
        amount: parseFloat(newOrder.amount),
        source: 'Offline'
      };
      
      await saveOrder(orderData);
      
      setIsAddOrderModalOpen(false);
      setNewOrder({ items: '', amount: '', date: '' });
      
      setConfirmationMessage({ text: isAr ? 'تم إضافة الطلب بنجاح!' : 'Offline order added successfully!', type: 'success' });
      setTimeout(() => setConfirmationMessage(null), 3000);
    } catch (error) {
      setConfirmationMessage({ text: isAr ? 'فشل في إضافة الطلب.' : 'Failed to add order.', type: 'error' });
      setTimeout(() => setConfirmationMessage(null), 3000);
    } finally {
      setIsAddingOrder(false);
    }
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      const orderRef = doc(db, "orders", editingOrder.id);
      await updateDoc(orderRef, {
        items: editingOrder.items,
        amount: parseFloat(editingOrder.amount),
        source: editingOrder.source?.toLowerCase()
      });
      setIsEditOrderModalOpen(false);
      setEditingOrder(null);
      setConfirmationMessage({ text: isAr ? 'تم تحديث الطلب بنجاح!' : 'Order updated successfully!', type: 'success' });
      setTimeout(() => setConfirmationMessage(null), 3000);
    } catch (error) {
      setConfirmationMessage({ text: isAr ? 'فشل في تحديث الطلب.' : 'Failed to update order.', type: 'error' });
      setTimeout(() => setConfirmationMessage(null), 3000);
    }
  };

  const handleDeleteOrder = (id: string) => {
    setConfirmConfig({
      title: isAr ? 'حذف الطلب' : 'Delete Order',
      message: isAr ? 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this order? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "orders", id));
          setConfirmationMessage({ text: isAr ? 'تم حذف الطلب بنجاح!' : 'Order deleted successfully!', type: 'success' });
          setTimeout(() => setConfirmationMessage(null), 3000);
        } catch (error) {
          console.error('Error deleting order:', error);
          setConfirmationMessage({ text: isAr ? 'فشل في حذف الطلب.' : 'Failed to delete order.', type: 'error' });
          setTimeout(() => setConfirmationMessage(null), 3000);
        }
      }
    });
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="pt-32 pb-32 px-6 min-h-screen bg-mud-sand/30">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Confirmation Message */}
        <AnimatePresence>
          {confirmationMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm tracking-widest uppercase flex items-center gap-3",
                confirmationMessage.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
              )}
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {confirmationMessage.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-6", isAr && "md:flex-row-reverse")}>
          <div className="space-y-2">
            <h1 className="text-4xl font-serif font-bold text-mud-ink italic">
              {isAr ? 'لوحة التحكم' : 'Admin Dashboard'}
            </h1>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('orders')}
                className={cn(
                  "uppercase tracking-widest text-xs font-bold pb-1 border-b-2 transition-all",
                  activeTab === 'orders' ? "text-mud-earth border-mud-earth" : "text-mud-ink/30 border-transparent hover:text-mud-ink"
                )}
              >
                {t.dashboard.orderManagement}
              </button>
              <button 
                onClick={() => setActiveTab('menu')}
                className={cn(
                  "uppercase tracking-widest text-xs font-bold pb-1 border-b-2 transition-all",
                  activeTab === 'menu' ? "text-mud-earth border-mud-earth" : "text-mud-ink/30 border-transparent hover:text-mud-ink"
                )}
              >
                {t.dashboard.menuManagement}
              </button>
            </div>
          </div>
          
          <div className="flex gap-3">
            {activeTab === 'menu' ? (
              <button 
                onClick={() => {
                  if (isMenuLocked) return;
                  setIsMenuModalOpen(true);
                }}
                disabled={isMenuLocked}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-2 shadow-lg",
                  isMenuLocked 
                    ? "bg-mud-sand text-mud-clay/40 cursor-not-allowed shadow-none border border-mud-earth/5" 
                    : "bg-mud-earth text-white hover:bg-mud-clay shadow-mud-earth/20"
                )}
              >
                <Plus size={18} />
                {t.dashboard.addNewItem}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setIsAddOrderModalOpen(true)}
                  className="bg-mud-sand text-mud-earth border border-mud-earth/20 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-mud-earth hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={16} />
                  {t.dashboard.addOfflineOrder}
                </button>
                <Link
                  to="/admin/reports"
                  className="bg-mud-earth text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-mud-clay transition-all flex items-center gap-2 shadow-lg shadow-mud-earth/20"
                >
                  <FileText size={16} />
                  {t.dashboard.salesReports}
                </Link>
                <Link
                  to="/admin-setup"
                  className="w-12 h-12 bg-white border border-mud-earth/10 rounded-xl flex items-center justify-center text-mud-clay hover:bg-mud-sand transition-colors"
                  title="Admin Setup"
                >
                  <Edit2 size={20} />
                </Link>
                <button 
                  onClick={logout}
                  className="w-12 h-12 bg-white border border-mud-earth/10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-12">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: t.dashboard.totalOrders, value: orderStats.total, icon: ShoppingCart },
                { label: t.dashboard.online, value: orderStats.online, icon: ShoppingCart },
                { label: t.dashboard.offline, value: orderStats.offline, icon: ShoppingCart },
                { label: t.dashboard.totalRevenue, value: `${orderStats.revenue.toFixed(2)} SAR`, icon: DollarSign },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-mud-earth/5 flex flex-col justify-between min-h-[160px] shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="space-y-4">
                    <div className="bg-mud-clay text-white px-3 py-1 rounded-lg inline-block text-[10px] font-bold uppercase tracking-widest">
                      {stat.label}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-serif font-bold text-mud-ink italic">{stat.value.toString().split(' ')[0]}</p>
                      {stat.value.toString().includes('SAR') && <span className="text-sm font-bold text-mud-ink/40">SAR</span>}
                    </div>
                  </div>
                  <stat.icon size={80} className="absolute -right-4 -bottom-4 text-mud-ink opacity-[0.03] group-hover:opacity-[0.05] transition-opacity" />
                </div>
              ))}
            </div>

            {/* Orders Section */}
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-1 bg-mud-clay rounded-full" />
                  <h2 className="text-3xl font-serif font-bold italic text-mud-ink">Orders</h2>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => loadOrders(true)} 
                    disabled={isRefreshing} 
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E89B2F]/30 rounded-full text-sm font-bold text-[#7A1B1B] hover:bg-[#E89B2F]/10 transition disabled:opacity-50"
                  >
                    <span className={`inline-block transition-transform ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="bg-white rounded-[3rem] p-24 text-center border border-mud-earth/5 shadow-sm">
                    <div className="w-24 h-24 bg-mud-sand rounded-full flex items-center justify-center mx-auto mb-8 text-mud-clay">
                      <ShoppingCart size={40} />
                    </div>
                    <p className="text-mud-ink/40 font-serif text-xl italic">No orders found for this period.</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className={cn(
                      "bg-white p-8 rounded-[2.5rem] border border-mud-earth/5 shadow-sm flex flex-col lg:flex-row lg:items-center gap-8 group hover:shadow-md transition-all relative overflow-hidden",
                      order.source === 'offline' && "border-l-8 border-l-mud-earth"
                    )}>
                      <div className="lg:w-48 space-y-2">
                        <div className="bg-mud-sand text-mud-clay text-[10px] font-bold px-4 py-2 rounded-xl inline-block uppercase tracking-widest">
                          #{order.orderId || order.id.slice(0, 8)}
                        </div>
                        <p className="text-xs text-mud-ink/40 font-bold pl-1">
                          {new Date(order.date).toLocaleDateString('en-SA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      
                      <div className="flex-grow space-y-4">
                        <p className="text-lg font-bold text-mud-ink leading-tight">{order.items}</p>
                        <div className="flex flex-wrap gap-3">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-xl flex items-center gap-2",
                            order.source?.toLowerCase() === 'offline' ? "bg-mud-earth/10 text-mud-earth" : "bg-green-100 text-green-700"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", order.source?.toLowerCase() === 'offline' ? "bg-mud-earth" : "bg-green-600")} />
                            {order.source}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-xl bg-mud-sand text-mud-ink/60 flex items-center gap-2">
                            <RefreshCw size={12} className="text-mud-clay" />
                            {new Date(order.date).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-12">
                        <div className="text-right">
                          <p className="text-4xl font-serif font-bold text-mud-ink italic">
                            {order.amount} <span className="text-sm font-sans not-italic text-mud-ink/40 uppercase tracking-widest">SAR</span>
                          </p>
                        </div>
                        
                        {order.source === 'offline' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingOrder(order);
                                setIsEditOrderModalOpen(true);
                              }}
                              className="w-12 h-12 bg-mud-sand text-mud-clay rounded-2xl flex items-center justify-center hover:bg-mud-clay hover:text-white transition-all shadow-sm"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-12">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: isAr ? 'إجمالي الأصناف' : 'Total Items', value: menuStats.total, icon: Utensils },
                { label: isAr ? 'الفئات' : 'Categories', value: menuStats.categories, icon: LayoutDashboard },
                { label: isAr ? 'متوسط السعر' : 'Avg Price', value: `${menuStats.avgPrice} SAR`, icon: Info },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-mud-earth/5 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-mud-sand rounded-2xl flex items-center justify-center text-mud-clay">
                    <stat.icon size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">{stat.label}</p>
                    <p className="text-2xl font-serif font-bold text-mud-ink italic">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-mud-ink/30" size={18} />
                <input 
                  type="text"
                  placeholder={t.dashboard.searchMenu}
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full bg-white border border-mud-earth/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-mud-clay shadow-sm"
                />
              </div>
              <button 
                onClick={() => setIsMenuLocked(!isMenuLocked)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm border",
                  isMenuLocked ? "bg-mud-sand text-mud-clay border-mud-earth/10" : "bg-mud-earth text-white border-mud-earth"
                )}
              >
                {isMenuLocked ? <Lock size={16} /> : <Unlock size={16} />}
                {isMenuLocked ? 'Management Locked' : 'Management Unlocked'}
              </button>
              <button 
                onClick={restoreDefaultMenu}
                disabled={isMenuLocked}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm border bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Restore Defaults
              </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-mud-ink/5 border border-mud-earth/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-mud-ink text-mud-gold uppercase tracking-widest text-[10px] font-bold">
                      <th className="p-6">{isAr ? 'اسم الصنف (EN)' : 'Item Name (EN)'}</th>
                      <th className="p-6">{isAr ? 'اسم الصنف (AR)' : 'Item Name (AR)'}</th>
                      <th className="p-6">{isAr ? 'الفئة' : 'Category'}</th>
                      <th className="p-6">{isAr ? 'السعر (SAR)' : 'Price (SAR)'}</th>
                      <th className="p-6 text-right">{isAr ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mud-earth/5">
                    {filteredMenuItems.map((item) => (
                      <tr key={item.id} className="hover:bg-mud-sand/20 transition-colors group">
                        <td className="p-6">
                          <div className="font-serif text-lg font-bold text-mud-ink">{item.name.en}</div>
                        </td>
                        <td className="p-6">
                          <div className="font-serif text-lg font-bold text-right text-mud-ink" dir="rtl">{item.name.ar}</div>
                        </td>
                        <td className="p-6">
                          <span className="px-3 py-1 bg-mud-sand text-mud-clay rounded-full text-[10px] font-bold uppercase tracking-widest">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-6 font-bold text-mud-earth">{item.price}</td>
                        <td className="p-6">
                          <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => {
                                if (isMenuLocked) return;
                                setEditingMenuItem(item);
                                setIsEditMenuModalOpen(true);
                              }}
                              disabled={isMenuLocked}
                              className="w-10 h-10 rounded-xl bg-mud-sand text-mud-clay flex items-center justify-center hover:bg-mud-clay hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isMenuLocked ? "Unlock management to edit" : "Edit Item"}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              disabled={isMenuLocked}
                              className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isMenuLocked ? "Unlock management to delete" : "Delete Item"}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Add Menu Item Modal */}
        {isMenuModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuModalOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6"
            >
              <h2 className="text-3xl font-serif font-bold italic text-mud-ink">Add New Item</h2>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Item Name (English)</label>
                  <input 
                    type="text" 
                    required
                    value={newItem.nameEn}
                    onChange={(e) => setNewItem({ ...newItem, nameEn: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                    placeholder="e.g. Lamb Mandi"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Item Name (Arabic)</label>
                  <input 
                    type="text" 
                    required
                    value={newItem.nameAr}
                    onChange={(e) => setNewItem({ ...newItem, nameAr: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors text-right"
                    dir="rtl"
                    placeholder="مثال: مندي لحم"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Category</label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Price (SAR)</label>
                  <input 
                    type="number" 
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsMenuModalOpen(false)}
                    className="flex-1 border border-mud-earth/10 text-mud-ink/60 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-sand transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-mud-earth text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-clay transition-colors"
                  >
                    Add Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Menu Item Modal */}
        {isEditMenuModalOpen && editingMenuItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsEditMenuModalOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6"
            >
              <h2 className="text-3xl font-serif font-bold italic text-mud-ink">{isAr ? 'تعديل الصنف' : 'Edit Item'}</h2>
              <form onSubmit={handleEditItem} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">{isAr ? 'اسم الصنف (إنجليزي)' : 'Item Name (English)'}</label>
                  <input 
                    type="text" required
                    value={editingMenuItem.name.en}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: { ...editingMenuItem.name, en: e.target.value } })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">{isAr ? 'اسم الصنف (عربي)' : 'Item Name (Arabic)'}</label>
                  <input 
                    type="text" required
                    value={editingMenuItem.name.ar}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: { ...editingMenuItem.name, ar: e.target.value } })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors text-right"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">{isAr ? 'الفئة' : 'Category'}</label>
                  <select 
                    value={editingMenuItem.category}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, category: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">{isAr ? 'السعر (SAR)' : 'Price (SAR)'}</label>
                  <input 
                    type="number" required
                    value={editingMenuItem.price}
                    onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: parseFloat(e.target.value) })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditMenuModalOpen(false)}
                    className="flex-1 border border-mud-earth/10 text-mud-ink/60 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-sand transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-mud-earth text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-clay transition-colors"
                  >
                    {isAr ? 'حفظ التغييرات' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Order Modal */}
        {isAddOrderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddOrderModalOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6"
            >
              <h2 className="text-3xl font-serif font-bold italic text-mud-ink">Add Offline Order</h2>
              <form onSubmit={handleAddOrder} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Items Ordered</label>
                  <input 
                    type="text" required
                    value={newOrder.items}
                    onChange={(e) => setNewOrder({ ...newOrder, items: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                    placeholder="e.g. 2x Mutabbaq, 1x Tea"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Amount (SAR)</label>
                  <input 
                    type="number" required
                    value={newOrder.amount}
                    onChange={(e) => setNewOrder({ ...newOrder, amount: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={newOrder.date}
                    onChange={(e) => setNewOrder({ ...newOrder, date: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsAddOrderModalOpen(false)} 
                    disabled={isAddingOrder}
                    className="flex-1 border border-mud-earth/10 text-mud-ink/60 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-sand transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isAddingOrder}
                    className="flex-1 bg-mud-earth text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-clay transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAddingOrder ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Add Order'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Order Modal */}
        {isEditOrderModalOpen && editingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsEditOrderModalOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6"
            >
              <h2 className="text-3xl font-serif font-bold italic text-mud-ink">Edit Order</h2>
              <form onSubmit={handleEditOrder} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Items Ordered</label>
                  <input 
                    type="text" required
                    value={editingOrder.items}
                    onChange={(e) => setEditingOrder({ ...editingOrder, items: e.target.value })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Amount (SAR)</label>
                  <input 
                    type="number" required
                    value={editingOrder.amount}
                    onChange={(e) => setEditingOrder({ ...editingOrder, amount: parseFloat(e.target.value) })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-mud-ink/40">Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={new Date(new Date(editingOrder.date).getTime() - new Date(editingOrder.date).getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setEditingOrder({ ...editingOrder, date: new Date(e.target.value).toISOString() })}
                    className="w-full bg-mud-sand/50 border border-mud-earth/10 rounded-xl px-4 py-3 focus:outline-none focus:border-mud-clay transition-colors"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditOrderModalOpen(false)} className="flex-1 border border-mud-earth/10 text-mud-ink/60 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-sand transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 bg-mud-earth text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-clay transition-colors">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Generic Confirmation Modal */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl space-y-6 text-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                confirmConfig.type === 'danger' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
              )}>
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-bold italic text-mud-ink">{confirmConfig.title}</h2>
                <p className="text-mud-ink/60">{confirmConfig.message}</p>
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setIsConfirmModalOpen(false)} 
                  className="flex-1 border border-mud-earth/10 text-mud-ink/60 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-mud-sand transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    confirmConfig.onConfirm();
                    setIsConfirmModalOpen(false);
                  }}
                  className={cn(
                    "flex-1 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-colors shadow-lg",
                    confirmConfig.type === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  )}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 bg-mud-earth text-white p-4 rounded-full shadow-2xl hover:bg-mud-clay transition-all duration-300 group"
        >
          <ChevronRight className="-rotate-90 group-hover:-translate-y-1 transition-transform" size={24} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/login');
    }
  }, [user, loading, isAdmin, navigate]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-mud-sand">
      <div className="w-12 h-12 border-4 border-mud-earth border-t-transparent rounded-full animate-spin" />
    </div>
  );
  
  if (!user || !isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-mud-sand">
      <div className="w-12 h-12 border-4 border-mud-earth border-t-transparent rounded-full animate-spin" />
    </div>
  );
  
  return <>{children}</>;
};

const CartBadge = () => {
  const { cart } = useContext(CartContext);
  if (cart.length === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-mud-gold text-mud-ink text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {cart.reduce((sum, item) => sum + item.quantity, 0)}
    </span>
  );
};

interface Order {
  id: string;
  orderId?: string;
  customerName: string;
  items: {
    name: { en: string; ar: string };
    price: number;
    quantity: number;
  }[];
  total: number;
  date: string;
}

const InvoiceContent = ({ order, lang, id }: { order: Order; lang: Language; id?: string }) => {
  const totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);
  
  return (
    <div id={id} className="bg-[#FAF3E0] w-full max-w-lg mx-auto overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-[#7A1B1B] p-8 text-center relative">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-[#E89B2F] font-bold tracking-[0.4em] uppercase opacity-50">
          INVOICE — فاتورة
        </div>
        <div className="mt-4 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#E89B2F]/10 rounded-full flex items-center justify-center mb-4 border border-[#E89B2F]/20">
            <Coffee size={32} className="text-[#E89B2F]" />
          </div>
          <h2 className="text-3xl font-arabic font-bold text-[#FAF3E0] mb-1">مطعم مُد</h2>
          <p className="text-[10px] text-[#E89B2F] font-bold tracking-widest uppercase">Mud Restaurant — Al Madinah Al Munawwarah</p>
        </div>
        
        <div className="mt-8 flex justify-between items-end border-t border-[#E89B2F]/20 pt-6">
          <div className="text-left">
            <p className="text-[9px] text-[#E89B2F] font-bold uppercase mb-1">INVOICE NO / رقم الفاتورة</p>
            <p className="text-xs font-bold text-[#FAF3E0] tracking-wider">{order.orderId || order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-[#E89B2F] font-bold uppercase mb-1">DATE / التاريخ</p>
            <p className="text-xs font-bold text-[#FAF3E0]">
              {new Date(order.date).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
                timeZone: 'Asia/Riyadh'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white px-8 py-4 border-b border-[#E89B2F]/10">
        <p className="text-[8px] text-[#6B6560] font-bold uppercase mb-1">CUSTOMER / اسم العميل</p>
        <p className="text-sm font-bold text-[#1A1A1A]">{order.customerName}</p>
      </div>

      {/* Items Table */}
      <table className="w-full text-right border-collapse">
        <thead>
          <tr className="bg-[#7A1B1B] text-[#FAF3E0] text-[10px] font-bold uppercase tracking-wider">
            <th className="p-3 text-left">الإجمالي</th>
            <th className="p-3">السعر</th>
            <th className="p-3">الكمية</th>
            <th className="p-3">الصنف</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {order.items.map((item, idx) => (
            <tr key={idx} className="border-b border-[#E89B2F]/5">
              <td className="p-4 text-left">
                <div className="inline-flex items-center gap-1 bg-[#E89B2F] px-3 py-1 rounded-full text-[#7A1B1B] font-bold text-xs shadow-sm">
                  <span>{item.price * item.quantity} ر.س</span>
                </div>
              </td>
              <td className="p-4">
                <div className="inline-flex items-center gap-1 bg-[#E89B2F]/10 px-3 py-1 rounded-full text-[#C87800] font-bold text-xs border border-[#E89B2F]/20">
                  <span>{item.price} ر.س</span>
                </div>
              </td>
              <td className="p-4 text-sm font-bold text-[#1A1A1A]">{item.quantity}x</td>
              <td className="p-4">
                <div className="font-arabic font-bold text-[#1A1A1A] text-base leading-tight">{item.name.ar}</div>
                <div className="text-[9px] text-[#6B6560] uppercase tracking-widest mt-1">{item.name.en}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary & Grand Total */}
      <div className="bg-[#FAF3E0] p-4 px-8 border-b border-[#E89B2F]/10 flex justify-between items-center">
        <div className="text-[10px] text-[#6B6560] font-bold uppercase tracking-widest">
          {order.items.length} ITEMS / {totalItems} PIECES
        </div>
        <div className="font-arabic font-bold text-[#1A1A1A]">
          المجموع: <span className="text-[#C87800]">{order.total} ر.س</span>
        </div>
      </div>

      <div className="bg-[#7A1B1B] m-4 rounded-2xl p-6 flex justify-between items-center shadow-lg relative overflow-hidden">
        <div className="text-left">
          <div className="text-[10px] text-[#E89B2F] font-bold uppercase tracking-[0.2em] mb-1">GRAND TOTAL / الإجمالي الكلي</div>
          <div className="text-3xl font-serif text-[#FAF3E0] tracking-tighter">
            {order.total} <span className="text-xs font-sans font-bold text-[#E89B2F] uppercase ml-1">SAR</span>
          </div>
        </div>
        <div className="w-14 h-14 bg-[#E89B2F]/10 rounded-full flex items-center justify-center border border-[#E89B2F]/20">
          <ShoppingCart className="text-[#E89B2F]" size={28} />
        </div>
      </div>

      {/* Note Box */}
      <div className="mx-4 mb-6 p-6 rounded-2xl border-2 border-dashed border-[#E89B2F]/30 bg-white/50 text-center">
        <p className="font-arabic font-bold text-[#7A1B1B] text-sm mb-2">يُرجى الحضور للمطعم بعد 5 دقائق على الأقل من وقت الطلب</p>
        <p className="text-[10px] text-[#6B6560] font-medium italic">Please be available at the restaurant at least 5 minutes after placing your order.</p>
      </div>
    </div>
  );
};

const generateInvoicePDF = (order: Order) => {
  const doc = new jsPDF();
  
  // Brand Colors
  const burgundy: [number, number, number] = [122, 27, 27];
  const amber: [number, number, number] = [232, 155, 47];
  const cream: [number, number, number] = [250, 243, 224];
  
  // 1. Header Background
  doc.setFillColor(burgundy[0], burgundy[1], burgundy[2]);
  doc.rect(0, 0, 210, 45, 'F');
  
  // 2. Restaurant Name
  doc.setTextColor(amber[0], amber[1], amber[2]);
  doc.setFontSize(22);
  doc.text("MUD RESTAURANT", 105, 20, { align: 'center' });
  
  doc.setTextColor(cream[0], cream[1], cream[2]);
  doc.setFontSize(10);
  doc.text("AL MADINAH AL MUNAWWARAH, KSA", 105, 28, { align: 'center' });
  
  // 3. Invoice Info
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(10);
  doc.text(`Invoice No: ${order.id}`, 20, 60);
  doc.text(`Date: ${new Date(order.date).toLocaleString()}`, 20, 67);
  doc.text(`Customer: ${order.customerName}`, 20, 74);
  
  // 4. Prepare Table Data
  const tableData = order.items.map(item => [
    item.name.en,
    item.quantity,
    `${item.price} SAR`,
    `${item.price * item.quantity} SAR`
  ]);

  // 5. Generate Table
  autoTable(doc, {
    startY: 85,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: burgundy, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  // 6. Grand Total Box
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFillColor(burgundy[0], burgundy[1], burgundy[2]);
  doc.rect(140, finalY - 10, 50, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(`TOTAL: ${order.total} SAR`, 185, finalY, { align: 'right' });

  // 7. Footer Note
  doc.setTextColor(122, 27, 27);
  doc.setFontSize(9);
  doc.text("Please arrive at the restaurant 5 minutes after ordering.", 105, finalY + 25, { align: 'center' });
  doc.text("Thank you for your visit!", 105, finalY + 32, { align: 'center' });

  // 8. Save File
  doc.save(`Mud_Invoice_${order.id}.pdf`);
};

const OrderSuccessModal = ({ order, onClose }: { order: Order | null; onClose: () => void }) => {
  const { language: lang } = useLanguage();
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');

  // Pre-generate the invoice image immediately for instant sharing
  useEffect(() => {
    if (order) {
      const generateImage = async () => {
        setIsGenerating(true);
        const element = document.getElementById('invoice-capture-area');
        if (element) {
          try {
            // html-to-image is often faster and more reliable for simple DOM structures
            const blob = await htmlToImage.toBlob(element, {
              backgroundColor: '#FAF3E0',
              pixelRatio: 2,
              cacheBust: true,
            });
            
            if (blob) {
              const file = new File([blob], `invoice-${order.orderId || order.id}.png`, { type: 'image/png' });
              setShareFile(file);
            }
          } catch (err) {
            console.error('Image generation error:', err);
          } finally {
            setIsGenerating(false);
          }
        } else {
          setIsGenerating(false);
        }
      };
      
      const timer = setTimeout(generateImage, 500);
      return () => clearTimeout(timer);
    }
  }, [order]);

  const handleWhatsAppShare = async () => {
    if (!order) return;

    const msg = `مرحباً! إليك فاتورتك من مطعم مُد 🧾\nرقم الطلب: ${order.orderId || order.id}\nالمجموع: SAR ${order.total}`;

    // 1. Try System Share (Best for Mobile)
    // This allows sharing the ACTUAL image file to WhatsApp
    if (shareFile && navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      try {
        await navigator.share({
          files: [shareFile],
          title: 'Mud Restaurant Invoice',
          text: msg,
        });
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('System share failed:', err);
        } else {
          return; // User cancelled
        }
      }
    }

    // 2. Fallback: Copy Image to Clipboard + Open WhatsApp Link
    // This is the best way to "attach" an image to a specific contact chat from web
    if (shareFile && navigator.clipboard && navigator.clipboard.write) {
      setCopyStatus('copying');
      try {
        const data = [new ClipboardItem({ [shareFile.type]: shareFile })];
        await navigator.clipboard.write(data);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 4000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
        setCopyStatus('failed');
      }
    }

    // Open WhatsApp directly to the restaurant
    const whatsappUrl = `https://wa.me/${RESTAURANT_PHONE}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
      {/* Hidden capture area for high-quality sharing */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none">
        <div id="invoice-capture-area" className="w-[500px] bg-[#FAF3E0]">
          <InvoiceContent order={order} lang={lang} />
        </div>
      </div>

      {/* Copy Notification Toast */}
      <AnimatePresence>
        {copyStatus === 'copied' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[400] bg-[#1A1A1A] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            <div className="text-xs font-bold tracking-wide">
              {lang === 'en' 
                ? "Invoice copied! Just PASTE it in the WhatsApp chat." 
                : "تم نسخ الفاتورة! فقط قم بـ لَصقها في محادثة الواتساب."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[#FAF3E0] rounded-[30px] shadow-2xl overflow-hidden flex flex-col my-8"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <InvoiceContent order={order} lang={lang} />
        </div>

        {/* Action Buttons */}
        <div className="px-8 pb-8 pt-4 space-y-3 bg-[#FAF3E0]">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleWhatsAppShare} 
              disabled={isGenerating && !shareFile}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#25D366] text-white rounded-2xl font-bold text-[10px] tracking-[0.1em] uppercase hover:bg-[#128C7E] transition-all shadow-lg disabled:opacity-50"
            >
              {isGenerating && !shareFile ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <MessageCircle size={18} />
              )}
              {lang === 'en' ? 'WhatsApp' : 'واتساب'}
            </button>
            <button 
              onClick={() => generateInvoicePDF(order)}
              className="flex items-center justify-center gap-3 py-4 bg-white border border-[#E89B2F]/20 text-[#1A1A1A] rounded-2xl font-bold text-[10px] tracking-[0.1em] uppercase hover:bg-[#C87800] hover:text-white hover:border-[#C87800] transition-all duration-500 shadow-sm"
            >
              <Download size={18} />
              {lang === 'en' ? 'Download PDF' : 'تحميل PDF'}
            </button>
          </div>
          <button onClick={onClose} className="w-full py-4 bg-white border border-[#E89B2F]/20 text-[#1A1A1A] rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-[#7A1B1B] hover:text-white transition-all flex items-center justify-center gap-2">
            <X size={16} /> {lang === 'en' ? 'Close' : 'إغلاق'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Cart = () => {
  const { cart, removeFromCart, clearCart, updateQuantity } = useContext(CartContext);
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const isAr = language === 'ar';

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-cart', handleOpen);
    return () => window.removeEventListener('open-cart', handleOpen);
  }, []);

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    
    try {
      const orderId = Math.floor(1000 + Math.random() * 9000).toString();
      const itemsString = cart.map(item => `${item.name.en} x${item.quantity}`).join(', ');
      
      const orderData = {
        orderId,
        items: itemsString,
        amount: total,
        source: 'Online'
      };

      const fullOrder: Order = {
        id: orderId,
        orderId: orderId,
        customerName: 'Online Customer',
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total: total,
        date: new Date().toISOString()
      };

      // Start saving to Firestore in the background to avoid UI delay
      saveOrder(orderData).catch(err => console.error('Background save failed:', err));

      // Show success modal immediately for better UX
      setLastOrder(fullOrder);
      setIsOpen(false);
      clearCart();
      setShowSuccess(true);
    } catch (error) {
      console.error('Order placement failed:', error);
      setOrderError(isAr ? 'عذراً، حدث خطأ أثناء إتمام الطلب. يرجى المحاولة مرة أخرى.' : 'Sorry, an error occurred while placing your order. Please try again.');
      setTimeout(() => setOrderError(null), 5000);
    } finally {
      setIsPlacingOrder(false);
    }
  };


  return (
    <>
      {/* Success Message Modal */}
      <AnimatePresence>
        {showSuccess && (
          <OrderSuccessModal 
            order={lastOrder} 
            onClose={() => setShowSuccess(false)} 
          />
        )}
      </AnimatePresence>
      {cart.length > 0 && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 left-8 z-[60] bg-mud-ink text-white p-4 rounded-full shadow-2xl hover:bg-mud-clay transition-colors group flex items-center gap-2"
        >
          <ShoppingCart size={24} />
          <span className="bg-mud-gold text-mud-ink text-[10px] font-bold px-2 py-0.5 rounded-full">
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-end md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-mud-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative bg-mud-sand w-full max-w-md h-[90vh] md:h-full md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="p-6 border-b border-mud-earth/10 flex justify-between items-center bg-white">
                <h2 className="text-2xl font-serif font-bold italic text-mud-ink">
                  {isAr ? 'حقيبة الطلبات' : 'Your Cart'}
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-mud-ink/40 hover:text-mud-ink transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-mud-earth/5 rounded-full flex items-center justify-center mx-auto text-mud-earth/20">
                      <ShoppingCart size={40} />
                    </div>
                    <p className="text-mud-ink/40 font-serif italic">
                      {isAr ? 'حقيبتك فارغة' : 'Your cart is empty'}
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-mud-earth/5 flex gap-4">
                      <div className="flex-grow">
                        <h4 className="font-bold text-mud-ink">{item.name[language]}</h4>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-sm text-mud-ink/60">{item.price} SAR</p>
                          <span className="font-bold text-mud-earth">{item.price * item.quantity} SAR</span>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                          <div className="flex items-center gap-4 bg-mud-sand/30 rounded-2xl px-4 py-2 border border-mud-earth/10">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 flex items-center justify-center text-mud-earth hover:bg-mud-earth hover:text-white rounded-xl transition-all duration-300 shadow-sm active:scale-95"
                              aria-label={isAr ? 'تقليل الكمية' : 'Decrease Quantity'}
                            >
                              <Minus size={16} strokeWidth={2.5} />
                            </button>
                            <span className="text-base font-bold text-mud-ink min-w-[1.5rem] text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 flex items-center justify-center text-mud-earth hover:bg-mud-earth hover:text-white rounded-xl transition-all duration-300 shadow-sm active:scale-95"
                              aria-label={isAr ? 'زيادة الكمية' : 'Increase Quantity'}
                            >
                              <Plus size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest hover:text-red-500 transition-colors"
                            aria-label={isAr ? 'إزالة من الحقيبة' : 'Remove from cart'}
                          >
                            {isAr ? 'إزالة' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 bg-white border-t border-mud-earth/10 space-y-4">
                  <div className="flex justify-between items-center text-xl font-serif font-bold italic">
                    <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                    <span className="text-mud-earth">{total} SAR</span>
                  </div>
                  {orderError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold text-center mb-4">
                      {orderError}
                    </div>
                  )}
                  <button 
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder}
                    className="w-full bg-mud-earth text-white py-5 rounded-2xl font-bold uppercase tracking-widest hover:bg-mud-clay transition-all shadow-xl shadow-mud-earth/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isPlacingOrder ? (
                      <>
                        <RefreshCw className="animate-spin" size={20} />
                        {isAr ? 'جاري الطلب...' : 'Placing Order...'}
                      </>
                    ) : (
                      isAr ? 'إتمام الطلب' : 'Place Order'
                    )}
                  </button>
                  <button 
                    onClick={clearCart}
                    className="w-full text-mud-ink/40 text-[10px] font-bold uppercase tracking-widest hover:text-red-500 transition-colors"
                  >
                    {isAr ? 'مسح الحقيبة' : 'Clear Cart'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </>
  );
};

// --- Main App ---

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string>(ADMIN_EMAIL);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Listen for admin email changes in Firestore
    const unsubscribeAdmin = onSnapshot(doc(db, 'settings', 'admin'), (snapshot) => {
      if (snapshot.exists()) {
        setAdminEmail(snapshot.data().adminEmail);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeAdmin();
    };
  }, []);

  const isAdmin = user?.email === adminEmail || user?.email === "armyprince7@gmail.com";

  const login = async () => {}; // Handled in LoginPage
  const resetPassword = async () => {}; // Handled in LoginPage
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const t = translations[language];
  const translate = (name: { en: string; ar: string }) => name[language];

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const clearCart = () => setCart([]);

  useEffect(() => {
    // Pre-load category images for instant switching
    Object.values(CATEGORY_IMAGES).forEach((url) => {
      const img = new Image();
      img.src = url;
    });

    // Pre-load featured dishes images
    [
      'https://images.pexels.com/photos/29177376/pexels-photo-29177376.jpeg',
      'https://media.istockphoto.com/id/1400980767/photo/ham-sandwich-with-cheese-lettuce-and-tomato.jpg?b=1&s=612x612&w=0&k=20&c=UKgVkjyFqZJN7VWyA4yxZBIJ335KLo7wJo9bNV-bvGw=',
      'https://images.pexels.com/photos/11830227/pexels-photo-11830227.jpeg'
    ].forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, resetPassword, logout }}>
      <LanguageContext.Provider value={{ language, lang: language, setLanguage, t, translate }}>
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
          <ErrorBoundary>
            <Router>
              <ScrollToTop />
              <div className={cn("min-h-screen", language === 'ar' ? "font-arabic" : "font-sans")} dir={language === 'ar' ? "rtl" : "ltr"}>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/reports" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
                  <Route path="/admin-setup" element={<ProtectedRoute><AdminSetup /></ProtectedRoute>} />
                </Routes>
                <Footer />
                <Cart />
                <BackToTop />
              </div>
            </Router>
          </ErrorBoundary>
        </CartContext.Provider>
      </LanguageContext.Provider>
    </AuthContext.Provider>
  );
}
