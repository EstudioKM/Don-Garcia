import React, { useEffect, useState } from 'react';
import { getMapsInfo } from '../services/geminiService';

const LocationSection: React.FC = () => {
  const [mapLinks, setMapLinks] = useState<any[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      // La llamada a la API ahora solo busca los enlaces de mapas, no el texto principal.
      const data = await getMapsInfo(-31.6041, -60.6751);
      setMapLinks(data?.links || []);
      setLoadingLinks(false);
    };
    fetchMapData();
  }, []);

  return (
    <section id="location" className="py-24 bg-[#0a0a0a] border-y border-stone-900">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <span className="text-gold uppercase tracking-[0.3em] md:tracking-[0.4em] text-[9px] md:text-[10px] mb-4 md:mb-6 block">Encuéntranos en Guadalupe</span>
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-6 md:mb-8 leading-tight">Una Ubicación <span className="italic">Histórica</span></h2>
            
            <div className="space-y-6">
              <p className="text-stone-300 leading-relaxed text-base md:text-lg border-l-2 border-gold/20 pl-6 md:pl-8">
                Más que un restaurante, Don García es una invitación a viajar en el tiempo. Nuestra casa, una Casona patrimonial de 1930, conserva la arquitectura y el espíritu de la Santa Fe de antaño. Cada rincón ha sido pensado para que su velada sea una experiencia inmersiva.
              </p>
              <p className="text-stone-400 leading-relaxed text-sm md:text-base">
                 Lo invitamos a sentir la historia que vive en este emblemático refugio de Guadalupe, donde la alta cocina y el legado se encuentran frente al río.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                {!loadingLinks && mapLinks.map((chunk: any, i: number) => (
                  chunk.maps && (
                    <a 
                      key={i} 
                      href={chunk.maps.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-stone-900 px-6 py-3 border border-stone-800 rounded-sm hover:border-gold transition-all group"
                    >
                      <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                      <span className="text-[9px] uppercase tracking-widest text-stone-400 group-hover:text-white">Ver en Maps</span>
                    </a>
                  )
                ))}
                <a 
                  href="https://www.instagram.com/dongarcia.sf/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 border border-stone-800 rounded-sm hover:border-gold hover:text-white transition-all group"
                >
                  <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  <span className="text-[9px] uppercase tracking-widest">Instagram</span>
                </a>
              </div>
            </div>
            
            <div className="mt-8 md:mt-12 pt-8 md:pt-12 border-t border-stone-800">
               <p className="text-stone-200 font-serif mb-2 text-base md:text-lg">Don García – Santa Fe</p>
               <p className="text-stone-500 text-xs mb-1">Guadalupe, Riobamba 8180</p>
               <p className="text-stone-500 text-xs">@dongarcia.sf</p>
            </div>
          </div>
          
          <div className="relative h-[300px] md:h-[500px] overflow-hidden rounded-sm shadow-xl">
             <img 
               src="https://images.unsplash.com/photo-1579532582937-16c108930bf6?auto=format&fit=crop&q=80&w=1974" 
               alt="Fachada nocturna de la Casona de 1930 de Don García" 
               className="w-full h-full object-cover transition-all duration-1000 opacity-80"
             />
             <div className="absolute inset-0 bg-gold/10 pointer-events-none"></div>
             <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur px-3 py-1.5 rounded-sm shadow-lg">
                <p className="text-[8px] uppercase tracking-widest text-gold font-bold">Reserva recomendada</p>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LocationSection;