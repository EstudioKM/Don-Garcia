import React from 'react';

const EventsSection: React.FC = () => {
  const handleReservationClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.hash = '/reservar';
  };

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 items-center">
        <div className="order-2 md:order-1">
          <span className="text-gold uppercase tracking-[0.3em] md:tracking-[0.4em] text-[9px] md:text-[10px] mb-4 md:mb-6 block">Un Entorno Único</span>
          <h2 className="text-3xl md:text-5xl font-serif mb-6 md:mb-8 leading-tight text-white">Eventos <span className="italic">Exclusivos</span></h2>
          <p className="text-stone-400 mb-6 md:mb-8 leading-relaxed text-base md:text-lg border-l-2 border-gold/20 pl-6 md:pl-8">
            Celebre sus momentos más importantes en el marco incomparable de una casona de 1930. Diseñamos experiencias a medida para eventos corporativos, presentaciones, casamientos y reuniones sociales.
          </p>
          <p className="text-stone-300 mb-8 md:mb-12 text-sm md:text-base leading-relaxed">
            Nuestro equipo se dedica a curar cada detalle, desde la gastronomía hasta la ambientación, asegurando que su evento sea tan memorable como el entorno histórico que nos rodea.
          </p>
          <a href="#/reservar" onClick={handleReservationClick} className="inline-block border border-gold text-gold px-10 md:px-12 py-3 md:py-4 hover:bg-gold hover:text-black transition-all duration-500 uppercase tracking-widest text-[9px] md:text-[10px]">
            Consultar
          </a>
        </div>
        <div className="relative h-[400px] md:h-[650px] order-1 md:order-2">
          <img 
            src="https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&q=80&w=1000" 
            alt="Plato de carne de alta cocina servido en un evento exclusivo" 
            className="w-full h-full object-cover rounded-sm shadow-2xl opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="absolute bottom-6 md:bottom-10 left-6 md:left-10">
            <p className="text-xl md:text-2xl font-serif text-white">Bodas & Presentaciones</p>
            <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-stone-400">en un marco histórico</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventsSection;