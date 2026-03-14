import React, { useState, useEffect, useRef } from 'react';

interface NavbarProps {
  onOpenSommelier: () => void;
  onOpenAdmin: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenSommelier, onOpenAdmin }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const logoClickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href');
    const targetId = href?.substring(1);
    if (targetId) {
      const section = document.getElementById(targetId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
    if (isMenuOpen) {
      closeMenu();
    }
  };
  
  const handleReservationClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.hash = '/reservar';
    if (isMenuOpen) {
      closeMenu();
    }
  };

  const handleLogoClick = () => {
    if (logoClickTimeoutRef.current) {
      clearTimeout(logoClickTimeoutRef.current);
    }
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);

    if (newClicks >= 5) {
      onOpenAdmin();
      setLogoClicks(0);
    } else {
      logoClickTimeoutRef.current = window.setTimeout(() => {
        setLogoClicks(0);
      }, 2000);
    }
  };

  return (
    <>
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled || isMenuOpen ? 'bg-luxury-black py-4 shadow-2xl' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div onClick={handleLogoClick} className="text-xl font-serif text-gold tracking-tighter font-bold cursor-pointer select-none">
            DON GARCÍA
          </div>
          
          <div className="hidden lg:flex space-x-8 items-center">
            <a href="#about" onClick={handleNavClick} className="text-white hover:text-gold transition-colors text-xs font-semibold uppercase tracking-widest">Nuestra Historia</a>
            <a href="#menu" onClick={handleNavClick} className="text-white hover:text-gold transition-colors text-xs font-semibold uppercase tracking-widest">La Carta</a>
            <a href="#location" onClick={handleNavClick} className="text-white hover:text-gold transition-colors text-xs font-semibold uppercase tracking-widest">Ubicación</a>
            <button onClick={onOpenSommelier} className="border border-gold text-gold px-6 py-2 rounded-sm hover:bg-gold hover:text-black transition-all text-xs font-bold uppercase tracking-widest">
              Sommelier AI
            </button>
            <a href="#/reservar" onClick={handleReservationClick} className="bg-gold text-white px-6 py-2 rounded-sm hover:scale-105 transition-all text-xs font-bold uppercase tracking-widest shadow-lg">Reservar</a>
          </div>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden text-white p-2 focus:outline-none"
            aria-label="Abrir menú"
          >
            <div className="w-6 h-5 relative flex flex-col justify-between">
              <span className={`w-full h-0.5 bg-gold transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`w-full h-0.5 bg-gold transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`w-full h-0.5 bg-gold transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-[11px]' : ''}`}></span>
            </div>
          </button>
        </div>
      </nav>

      <div className={`fixed inset-0 z-[60] bg-luxury-black transition-transform duration-500 transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'} lg:hidden`}>
        <div className="flex flex-col items-center justify-center h-full space-y-10">
          <button onClick={closeMenu} className="absolute top-6 right-6 text-gold text-4xl">&times;</button>
          <a href="#about" onClick={handleNavClick} className="text-3xl text-white font-serif tracking-widest hover:text-gold transition-colors">Nuestra Historia</a>
          <a href="#menu" onClick={handleNavClick} className="text-3xl text-white font-serif tracking-widest hover:text-gold transition-colors">La Carta</a>
          <a href="#location" onClick={handleNavClick} className="text-3xl text-white font-serif tracking-widest hover:text-gold transition-colors">Ubicación</a>
          <button onClick={() => { onOpenSommelier(); closeMenu(); }} className="text-3xl text-white font-serif tracking-widest hover:text-gold transition-colors">Sommelier AI</button>
          <a href="#/reservar" onClick={handleReservationClick} className="bg-gold text-white px-10 py-4 text-sm uppercase tracking-widest rounded-sm shadow-xl">Reservar Mesa</a>
        </div>
      </div>
    </>
  );
};

export default Navbar;
