import React, { useState, useEffect, useRef } from 'react';
import { getMenuFromDB } from '../services/menuRepository';

const formatPrice = (value: string): string => {
    if (typeof value !== 'string' || !value) return '';

    let processValue = value;
    if (processValue.endsWith('.00')) {
        processValue = processValue.slice(0, -3);
    }
    
    const digits = processValue.replace(/[^0-9]/g, '');
    if (digits === '') {
        return value.includes('$') ? '$' : '';
    }
    const number = parseInt(digits, 10);
    if (isNaN(number)) {
        return value;
    }
    return `$${new Intl.NumberFormat('es-AR').format(number)}`;
}

const Menu: React.FC = () => {
  type TabType = 'entradas' | 'pescados' | 'carnes' | 'pastas' | 'guarniciones' | 'postres' | 'vinos' | 'bebidas';
  
  const [activeTab, setActiveTab] = useState<TabType>('entradas');
  const [animate, setAnimate] = useState(false);
  const [menuData, setMenuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const stickyBarRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await getMenuFromDB();
      setMenuData(data);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    setAnimate(false);
    const timer = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const tabToKeys: Record<TabType, string[]> = {
    entradas: ['entradas', 'sugerencias'],
    pescados: ['pescados_de_rio', 'rio_a_la_parrilla', 'pescados_de_mar'],
    carnes: ['carnes_rojas', 'carnes_blancas', 'parrilla_ternera', 'parrilla_achuras_embutidos', 'parrilla_cerdo', 'parrilla_blancas'],
    pastas: ['pastas_caseras', 'pastas_sin_tacc', 'salsas'],
    guarniciones: ['guarniciones', 'ensaladas_especiales', 'menu_kids'],
    postres: ['postres_helados', 'postres_clasicos', 'cafeteria'],
    vinos: ['carta_de_vinos'],
    bebidas: ['bebidas_sin_alcohol', 'tragos_clasicos', 'cervezas', 'whisky']
  };

  const tabLabels: Record<TabType, string> = {
    entradas: 'Entradas',
    pescados: 'Pescados',
    carnes: 'Carnes',
    pastas: 'Pastas',
    guarniciones: 'Extras',
    postres: 'Postres',
    vinos: 'Vinos',
    bebidas: 'Bebidas'
  };

  const getMenuItems = () => {
    if (!menuData) return [];
    const keys = tabToKeys[activeTab];
    return keys.flatMap(key => {
        const items = menuData[key] || [];
        if (keys.length > 1 && items.length > 0) {
            return [
                { isHeader: true, name: key.replace(/_/g, ' ').toUpperCase() },
                ...items
            ];
        }
        return items;
    });
  };

  const menuItems = getMenuItems();

  if (loading) {
    return (
      <section className="py-24 bg-[#0a0a0a] min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gold uppercase tracking-widest text-xs">Cargando la carta...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-[#0a0a0a] border-y border-stone-900 relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="text-gold uppercase tracking-[0.4em] text-xs font-bold mb-4 block underline underline-offset-4 decoration-gold/30">Selección Don García</span>
          <h2 className="text-4xl md:text-6xl font-serif text-white">La Carta</h2>
        </div>

        <div ref={stickyBarRef} className="sticky top-[68px] z-40 bg-[#0a0a0a]/80 backdrop-blur-xl -mx-6 px-6 py-6 border-b-2 border-stone-900 mb-16">
          <div className="flex overflow-x-auto lg:justify-center items-center gap-8 no-scrollbar scrollbar-hide">
            {(Object.keys(tabLabels) as TabType[]).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`uppercase tracking-[0.2em] text-xs font-bold pb-2 transition-all relative whitespace-nowrap px-4 py-2 rounded-sm ${activeTab === tab ? 'text-gold bg-gold/5' : 'text-stone-500 hover:text-stone-300'}`}
              >
                {tabLabels[tab]}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gold"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div ref={listContainerRef} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {menuItems.map((item: any, index: number) => (
            item.isHeader ? (
                <div key={`header-${index}`} className="col-span-1 md:col-span-2 mt-10 mb-2 border-l-4 border-gold pl-6 bg-black/30 py-3">
                    <span className="text-[10px] uppercase tracking-[0.4em] font-black text-stone-400">{item.name}</span>
                </div>
            ) : (
                <div 
                  key={item.id || index} 
                  className={`group flex justify-between items-start border-b border-stone-900 pb-6 transition-all duration-500 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${index * 10}ms` }}
                >
                  <div className="max-w-[70%]">
                    <h3 className="text-xl font-serif text-stone-100 mb-2 leading-snug group-hover:text-gold transition-colors">
                      {item.name}
                    </h3>
                    {item.description && (
                        <p className="text-stone-400 text-sm leading-relaxed font-medium italic">
                          {item.description}
                        </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-gold font-bold tracking-tight text-lg block whitespace-nowrap bg-black/30 px-3 py-1 rounded-sm">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </div>
            )
          ))}
        </div>

        <div className="mt-20 text-center py-10 bg-black/30 border-y border-stone-900 rounded-sm">
           <p className="text-stone-500 text-xs font-bold uppercase tracking-[0.3em] mb-4">Aclaración Importante</p>
           <p className="max-w-2xl mx-auto text-stone-400 text-base leading-relaxed italic mb-8">
             “Nuestra cocina trabaja con productos de estación. Si usted posee alguna alergia o restricción alimentaria, por favor hágaselo saber a su mozo.”
           </p>
           <div className="flex flex-wrap justify-center gap-8 text-xs font-black text-gold uppercase tracking-[0.2em]">
              <span className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-gold"></span>
                Servicio de mesa: $1.500
              </span>
              <span className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-gold"></span>
                IVA incluido
              </span>
           </div>
        </div>
      </div>
    </section>
  );
};

export default Menu;