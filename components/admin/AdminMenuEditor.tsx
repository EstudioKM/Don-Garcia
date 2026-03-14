import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getMenuFromDB, saveMenuToDB } from '../../services/menuRepository';

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

const AdminMenuEditor: React.FC = () => {
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'info'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadMenu = async () => {
      const menuData = await getMenuFromDB();
      if (!menuData.carta_de_vinos) {
        menuData.carta_de_vinos = [];
      }
      setMenu(menuData);
      setLoading(false);
    };
    loadMenu();
  }, []);

  const handleInputChange = (category: string, id: string, field: string, value: string) => {
    if (!menu) return;
    const updatedMenu = { ...menu };
    const itemIndex = updatedMenu[category].findIndex((item: any) => item.id === id);
    if (itemIndex > -1) {
      updatedMenu[category][itemIndex][field] = value;
      setMenu(updatedMenu);
    }
  };
  
  const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, category: string, id: string) => {
    const formattedValue = formatPrice(e.target.value);
    handleInputChange(category, id, 'price', formattedValue);
  };

  const handleAddItem = (category: string) => {
    if (!menu) return;
    const newItem = {
      id: `new-${Date.now()}`,
      name: '',
      price: '',
      description: ''
    };
    const updatedMenu = { ...menu };
    updatedMenu[category] = [newItem, ...updatedMenu[category]];
    setMenu(updatedMenu);
  };

  const handleDeleteItem = (category: string, id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este plato de la carta?')) {
      const updatedMenu = { ...menu };
      updatedMenu[category] = updatedMenu[category].filter((item: any) => item.id !== id);
      setMenu(updatedMenu);
    }
  };

  const handleSave = async () => {
    if (!menu) return;
    setIsSaving(true);
    setStatus('idle');
    try {
      await saveMenuToDB(menu);
      setStatus('success');
      setStatusMessage('¡Carta guardada con éxito!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
      setStatusMessage('Error al guardar la carta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearWines = () => {
    if (window.confirm('¿Está seguro de que desea eliminar TODOS los vinos de la carta? Esta acción no se puede deshacer una vez guardada.')) {
      setMenu((prevMenu: any) => ({
        ...prevMenu,
        carta_de_vinos: []
      }));
      setStatus('info');
      setStatusMessage('Carta de vinos vaciada. Haga clic en "Guardar Cambios" para confirmar.');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };
  
  const handleFileImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("El archivo CSV está vacío o no tiene datos.");

        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const marcaIndex = header.indexOf('marca');
        const precioIndex = header.indexOf('precio');

        if (marcaIndex === -1 || precioIndex === -1) {
          throw new Error("El archivo CSV debe contener las columnas 'marca' y 'precio'.");
        }

        const wineList = lines.slice(1).map((line, index) => {
          const columns = line.split(',');
          const rawPrice = columns[precioIndex]?.trim() || '0';
          return {
            id: `wine-${Date.now()}-${index}`,
            name: columns[marcaIndex]?.trim() || 'Sin Nombre',
            price: formatPrice(rawPrice),
            description: ''
          };
        });

        setMenu((prevMenu: any) => ({
          ...prevMenu,
          carta_de_vinos: wineList
        }));

        setStatus('info');
        setStatusMessage(`${wineList.length} vinos importados. Haga clic en "Guardar Cambios" para publicarlos.`);
        setTimeout(() => setStatus('idle'), 5000);

      } catch (error: any) {
        setStatus('error');
        setStatusMessage(error.message || "Error al procesar el archivo CSV.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const formatCategoryName = (key: string) => {
    return key.replace(/_/g, ' ').toUpperCase();
  };

  const menuCategories = useMemo(() => {
    if (!menu) return [];
    return Object.keys(menu).filter(key => Array.isArray(menu[key]));
  }, [menu]);

  const filteredMenu = useMemo(() => {
    if (!menu) return null;

    let categoriesToProcess = Object.keys(menu);
    if (categoryFilter !== 'all') {
      categoriesToProcess = categoriesToProcess.filter(cat => cat === categoryFilter);
    }
    
    const initialResult: any = {};
    categoriesToProcess.forEach(cat => {
      if(Array.isArray(menu[cat])) {
        initialResult[cat] = menu[cat];
      }
    });

    if (!searchTerm) {
      return initialResult;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const finalResult: any = {};
    Object.keys(initialResult).forEach(category => {
      const items = initialResult[category];
      const filteredItems = items.filter((item: any) => 
        item.name?.toLowerCase().includes(lowerTerm) || 
        (item.description && item.description.toLowerCase().includes(lowerTerm))
      );
      
      if (filteredItems.length > 0) {
        finalResult[category] = filteredItems;
      }
    });
    return finalResult;
  }, [menu, searchTerm, categoryFilter]);

  if (loading) return <div className="text-white text-center p-10">Cargando editor de carta...</div>;
  
  const getButtonClasses = () => {
    switch(status) {
      case 'success': return 'bg-green-800 border-green-700 text-white';
      case 'error': return 'bg-red-800 border-red-700 text-white';
      case 'info': return 'bg-blue-800 border-blue-700 text-white';
      default: return 'bg-gold border-gold text-white hover:bg-white hover:text-black';
    }
  };

  return (
    <>
      <div className="sticky top-[-1px] z-10 bg-luxury-black/80 backdrop-blur-md py-4 -mx-6 px-6 md:-mx-12 md:px-12 border-b border-stone-800 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div>
                  <input type="text" className="block w-full pl-10 pr-3 py-3 border border-stone-700 rounded-sm leading-5 bg-stone-900/50 text-stone-300 placeholder-stone-500 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm transition-colors" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative w-full sm:w-64">
                  <select 
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="block w-full pl-3 pr-10 py-3 border border-stone-700 rounded-sm leading-5 bg-stone-900/50 text-stone-300 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm transition-colors appearance-none"
                    style={{ background: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a8a29e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") no-repeat right 0.75rem center/1.5em 1.5em`}}
                  >
                      <option value="all">Todas las categorías</option>
                      {menuCategories.map(cat => (
                          <option key={cat} value={cat}>{formatCategoryName(cat)}</option>
                      ))}
                  </select>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              <button onClick={handleFileImportClick} className="w-full sm:w-auto text-center px-4 py-3 border border-stone-600 text-stone-300 rounded-sm hover:border-gold hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                Importar Vinos (CSV)
              </button>
               <button onClick={handleClearWines} className="w-full sm:w-auto text-center px-4 py-3 border border-stone-700 text-stone-500 rounded-sm hover:border-red-500 hover:text-red-500 transition-all text-xs font-bold uppercase tracking-widest">
                Eliminar todos los vinos
              </button>
              <button onClick={handleSave} disabled={isSaving} className={`w-full sm:w-auto px-6 py-3 uppercase tracking-widest text-xs transition-all duration-500 shadow-xl border ${getButtonClasses()}`}>
                {isSaving ? 'Guardando...' : (status !== 'idle' && statusMessage) ? statusMessage : 'Guardar Cambios'}
              </button>
            </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-sm border border-stone-800 bg-stone-900/20 shadow-2xl">
        <table className="w-full border-collapse text-left min-w-[800px]">
          <thead>
            <tr className="bg-stone-900/50 border-b border-stone-800">
              <th className="py-5 px-8 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold w-1/3">Nombre del Plato / Vino</th>
              <th className="py-5 px-8 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold w-[150px]">Precio</th>
              <th className="py-5 px-8 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold">Descripción</th>
              <th className="py-5 px-8 text-[10px] uppercase tracking-[0.3em] text-gold font-semibold text-center w-[80px]">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {filteredMenu && Object.keys(filteredMenu).length > 0 ? (
              Object.entries(filteredMenu).map(([category, items]: [string, any]) => (
              !Array.isArray(items) ? null :
              <React.Fragment key={category}>
                <tr className="bg-stone-800/30 border-t border-stone-700/50 first:border-t-0">
                  <td colSpan={4} className="py-4 px-8 bg-gradient-to-r from-gold/10 to-transparent">
                    <div className="flex justify-between items-center">
                      <span className="text-gold uppercase tracking-[0.6em] text-[11px] font-bold">{formatCategoryName(category)}</span>
                      {(!searchTerm && categoryFilter === 'all') && (
                        <button onClick={() => handleAddItem(category)} className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-gold hover:text-white transition-colors bg-gold/10 hover:bg-gold px-3 py-1.5 rounded-sm">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                          Agregar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                
                {items.length === 0 && (
                  <tr><td colSpan={4} className="py-8 px-8 text-center text-stone-600 italic text-xs tracking-widest">No se encontraron productos en esta categoría.</td></tr>
                )}

                {items.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-5 px-8 align-top">
                      <input className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none text-white font-serif text-lg group-hover:text-gold transition-colors" value={item.name} onChange={(e) => handleInputChange(category, item.id, 'name', e.target.value)} placeholder="Nombre..."/>
                    </td>
                    <td className="py-5 px-8 align-top">
                      <input 
                        className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none text-gold font-light tracking-wider" 
                        value={item.price} 
                        onChange={(e) => handleInputChange(category, item.id, 'price', e.target.value)} 
                        onBlur={(e) => handlePriceBlur(e, category, item.id)}
                        placeholder="$0"
                      />
                    </td>
                    <td className="py-5 px-8 align-top">
                      <textarea className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none text-stone-400 text-sm font-light resize-none h-auto overflow-hidden min-h-[1.5rem]" value={item.description} onChange={(e) => { handleInputChange(category, item.id, 'description', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} placeholder="Descripción..." rows={1}/>
                    </td>
                    <td className="py-5 px-8 align-top text-center">
                      <button onClick={() => handleDeleteItem(category, item.id)} className="text-stone-700 hover:text-red-500 transition-colors p-2" title="Eliminar ítem">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))) : (
              <tr><td colSpan={4} className="py-16 px-8 text-center text-stone-600 italic">No se encontraron productos con los filtros aplicados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default AdminMenuEditor;