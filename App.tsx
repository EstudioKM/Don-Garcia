import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Menu from './components/Menu';
import Reservation from './components/Reservation';
import SommelierAssistant from './components/SommelierAssistant';
import { SommelierPage } from './components/SommelierPage';
import LocationSection from './components/LocationSection';
import EventsSection from './components/EventsSection';
import AdminMenu from './components/AdminMenu';
import { seedReservations, seedLayout, seedSettings, seedCustomers } from './services/seedService';
import ReservationPage from './components/ReservationPage';

const getRouteFromHash = () => {
  const hash = window.location.hash.substring(1); // -> "/reservar" o ""
  // Asegura que siempre devuelva una ruta válida que empiece con "/"
  if (!hash || hash === '/') {
    return '/';
  }
  return hash.startsWith('/') ? hash : `/${hash}`;
};

const App: React.FC = () => {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSommelierPageOpen, setIsSommelierPageOpen] = useState(false);
  const [route, setRoute] = useState(getRouteFromHash());

  useEffect(() => {
    // Si la base de datos está vacía, la llena con datos de ejemplo.
    const initializeData = async () => {
      await seedLayout();
      await seedSettings();
      await seedCustomers();
      await seedReservations();
    }
    initializeData();

    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, observerOptions);

    const elementsToObserve = document.querySelectorAll('.reveal');
    elementsToObserve.forEach(el => observer.observe(el));
    
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      elementsToObserve.forEach(el => observer.unobserve(el));
      observer.disconnect();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // El array vacío asegura que esto solo se ejecute una vez al montar el componente.

  const renderMainPage = () => (
    <>
      <Navbar onOpenSommelier={() => setIsSommelierPageOpen(true)} onOpenAdmin={() => setIsAdminOpen(true)} />
      <Hero />
      
      <section id="about" className="py-24 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 md:gap-24 items-center reveal">
        <div className="relative">
          <img 
            src="https://images.unsplash.com/photo-1579532582937-16c108930bf6?auto=format&fit=crop&q=80&w=1974" 
            alt="La Casona 1930 Don Garcia" 
            className="w-full h-[550px] md:h-[600px] object-cover shadow-2xl rounded-sm opacity-80"
          />
          <div className="absolute -bottom-8 -right-4 md:-bottom-10 md:-right-10 bg-[#111] border-t-2 border-gold p-8 md:p-10 shadow-2xl">
             <p className="text-4xl font-serif text-gold mb-2">1930</p>
             <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">Patrimonio Histórico</p>
          </div>
        </div>
        <div>
          <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-6 block">Riobamba 8180</span>
          <h2 className="text-4xl md:text-5xl font-serif mb-8 leading-tight text-white">
            La Casona de <span className="italic">Guadalupe</span>.
          </h2>
          <div className="space-y-5 text-stone-300 text-base md:text-lg leading-relaxed">
            <p>
              Construida en 1930 por la familia Beltrame, nuestra casa es un emblema del histórico barrio Guadalupe, ubicada justo frente al río Paraná.
            </p>
            <p>
              Don García rinde homenaje a la cocina de raíces: pescados frescos del Paraná, carnes a la estaca y una cava que resguarda lo mejor de nuestra tierra en un entorno que respira historia.
            </p>
          </div>
          <div className="mt-10">
             <a href="https://www.instagram.com/dongarcia.sf/" target="_blank" className="inline-flex items-center gap-4 font-bold text-gold text-base hover:underline transition-all group">
               <span className="w-10 h-[1px] bg-gold"></span>
               Ver fotos en Instagram
               <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
             </a>
          </div>
        </div>
      </section>

      <div id="menu" className="reveal">
        <Menu />
      </div>

      <div className="reveal">
        <EventsSection />
      </div>
      
      <div id="location" className="reveal">
        <LocationSection />
      </div>

      <div id="reservation" className="reveal">
        <Reservation />
      </div>

      <footer className="bg-luxury-black py-20 text-stone-400 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            <div className="col-span-1">
              <h4 className="text-gold font-serif text-3xl mb-6 tracking-widest uppercase">Don García</h4>
              <p className="max-w-md leading-relaxed text-base mb-8">
                Cocina de excelencia en un entorno patrimonial único. La tradición de la parrilla y el río desde 1930.
              </p>
              <div className="flex gap-6">
                 <a href="https://www.instagram.com/dongarcia.sf/" className="text-stone-300 hover:text-gold transition-colors font-bold uppercase tracking-widest text-xs underline underline-offset-4">Instagram</a>
                 <a href="#" className="text-stone-300 hover:text-gold transition-colors font-bold uppercase tracking-widest text-xs underline underline-offset-4">WhatsApp</a>
              </div>
            </div>
            <div>
              <p className="text-white font-bold mb-6 uppercase tracking-[0.3em] text-xs">Ubicación</p>
              <div className="space-y-3 text-base">
                <p className="text-white">Riobamba 8180</p>
                <p>Barrio Guadalupe, Santa Fe</p>
                <p>República Argentina</p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end">
             {/* El botón de acceso a gestión se ha eliminado para ocultarlo del usuario final */}
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest font-bold">
            <p className="mb-4 md:mb-0">© 2024 Don García - La Casona 1930.</p>
            <div className="flex space-x-8">
               <span className="hover:text-gold transition-colors cursor-pointer">Patrimonio Santafesino</span>
            </div>
          </div>
        </div>
      </footer>

      
      <SommelierAssistant onOpenPage={() => setIsSommelierPageOpen(true)} />
    </>
  );

  return (
    <div className={`min-h-screen bg-luxury-black text-stone-400 ${isSommelierPageOpen || isAdminOpen ? 'overflow-hidden' : ''}`}>
      {isAdminOpen ? <AdminMenu onClose={() => setIsAdminOpen(false)} /> : 
        isSommelierPageOpen ? <SommelierPage onClose={() => setIsSommelierPageOpen(false)} /> : 
        (route === '/reservar' ? <ReservationPage /> : renderMainPage())
      }
    </div>
  );
};

export default App;