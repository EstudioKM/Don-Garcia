import React, { useState } from 'react';
import AdminOrders from './admin/AdminOrders';
import AdminMenuEditor from './admin/AdminMenuEditor';
import AdminSommelier from './admin/AdminSommelier';
import AdminReservations from './admin/AdminReservations';
import AdminReservationsList from './admin/AdminReservationsList';
import AdminSettings from './admin/AdminSettings';
import AdminCustomers from './admin/AdminCustomers';
import AdminAnalytics from './admin/AdminAnalytics';

interface AdminMenuProps {
  onClose: () => void;
}

type AdminTab = 'reservations' | 'reservationsList' | 'customers' | 'analytics' | 'orders' | 'menu' | 'settings' | 'sommelier';

const AdminMenu: React.FC<AdminMenuProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('reservations');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const icons: Record<AdminTab, React.ReactNode> = {
    reservations: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
    reservationsList: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>,
    customers: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm-9 3a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>,
    analytics: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>,
    orders: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>,
    menu: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>,
    settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>,
    sommelier: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>,
  };

  const tabLabels: Record<AdminTab, string> = {
    reservations: 'Reservas',
    reservationsList: 'Listado',
    customers: 'Clientes',
    analytics: 'Estadísticas',
    orders: 'Comandas',
    menu: 'Carta',
    settings: 'Ajustes',
    sommelier: 'Sommelier',
  };

  const handleTabClick = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const TabButton: React.FC<{tab: AdminTab, label: string}> = ({ tab, label }) => (
    <button 
      onClick={() => handleTabClick(tab)} 
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-sm text-sm font-semibold tracking-wider transition-colors ${
        activeTab === tab 
          ? 'bg-gold/10 text-gold' 
          : 'text-stone-400 hover:bg-stone-800/50 hover:text-white'
      }`}
    >
      {icons[tab]}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-luxury-black text-stone-300 animate-fadeInUp flex h-full w-full">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`absolute top-0 left-0 h-full w-64 flex-shrink-0 bg-black/50 border-r border-stone-800 flex flex-col z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-stone-800 h-20 flex flex-col justify-center">
          <h2 className="text-xl font-serif text-gold tracking-widest">Gestión</h2>
          <p className="text-stone-600 text-[10px] uppercase tracking-[0.2em]">Don García</p>
        </div>
        <nav className="flex-grow p-4 space-y-2">
            <TabButton tab="reservations" label={tabLabels.reservations} />
            <TabButton tab="reservationsList" label={tabLabels.reservationsList} />
            <TabButton tab="customers" label={tabLabels.customers} />
            <TabButton tab="analytics" label={tabLabels.analytics} />
            <TabButton tab="orders" label={tabLabels.orders} />
            <TabButton tab="menu" label={tabLabels.menu} />
            <TabButton tab="settings" label={tabLabels.settings} />
            <TabButton tab="sommelier" label={tabLabels.sommelier} />
        </nav>
        <div className="p-4 border-t border-stone-800">
          <button onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm text-stone-500 hover:bg-stone-800/50 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h12"></path></svg>
            <span>Cerrar Panel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Mobile Header */}
        <header className="sticky top-0 z-20 md:hidden bg-luxury-black/80 backdrop-blur-lg border-b border-stone-800 p-4 flex items-center justify-between h-20">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-stone-300 hover:text-gold">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <h2 className="text-lg font-serif text-gold">{tabLabels[activeTab]}</h2>
            <div className="w-8"></div> {/* Spacer to balance the hamburger button */}
        </header>

        <main className="flex-grow">
            <div className="p-6 md:p-12">
                {activeTab === 'reservations' && <div className="-mx-6 md:-mx-12"><AdminReservations /></div>}
                {activeTab === 'reservationsList' && <AdminReservationsList />}
                {activeTab === 'customers' && <AdminCustomers />}
                {activeTab === 'analytics' && <AdminAnalytics />}
                {activeTab === 'orders' && <AdminOrders />}
                {activeTab === 'menu' && <AdminMenuEditor />}
                {activeTab === 'settings' && <AdminSettings />}
                {activeTab === 'sommelier' && <AdminSommelier />}
            </div>
        </main>
      </div>
    </div>
  );
};

export default AdminMenu;