
import React, { useState } from 'react';
import ReservationForm from './ReservationForm';

const Reservation: React.FC = () => {
  return (
    <section id="reservation" className="py-32 bg-luxury-black text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <img 
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=2000" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="text-center">
          <span className="text-gold uppercase tracking-[0.5em] text-xs font-bold mb-6 block">Experiencia Don García</span>
          <h2 className="text-5xl md:text-7xl mb-8 font-serif text-white leading-tight">
            Una mesa frente <br/> al <span className="italic text-gold">Paraná</span>
          </h2>
          <p className="text-stone-400 text-xl font-light italic mb-12 max-w-2xl mx-auto leading-relaxed">
            Lo invitamos a vivir una velada única en nuestra casona de 1930. 
            Reserve su lugar y déjese cautivar por los sabores de nuestra tierra.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a 
              href="#/reservar"
              className="w-full sm:w-auto bg-gold text-white px-16 py-6 rounded-full font-black uppercase tracking-[0.3em] text-sm hover:bg-white hover:text-black transition-all duration-500 shadow-[0_20px_50px_rgba(176,141,72,0.3)] active:scale-95"
            >
              Reservar Mesa
            </a>
            <a 
              href="https://wa.me/543424066887" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto border border-white/20 text-white px-12 py-6 rounded-full font-bold uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all"
            >
              Consultas WhatsApp
            </a>
          </div>
          
          <div className="mt-16 flex items-center justify-center space-x-8 text-stone-500">
            <div className="flex flex-col items-center">
              <span className="text-gold font-serif text-2xl">1930</span>
              <span className="text-[10px] uppercase tracking-widest">Historia</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-gold font-serif text-2xl">8180</span>
              <span className="text-[10px] uppercase tracking-widest">Riobamba</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reservation;
