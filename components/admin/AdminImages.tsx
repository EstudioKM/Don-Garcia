import React from 'react';
import { RestaurantSettings, WebImages } from '../../types';
import { produce } from 'immer';
import { Image as ImageIcon, Upload, X, Globe } from 'lucide-react';

interface AdminImagesProps {
  settings: RestaurantSettings;
  setSettings: React.Dispatch<React.SetStateAction<RestaurantSettings | null>>;
}

const AdminImages: React.FC<AdminImagesProps> = ({ settings, setSettings }) => {
  const webImages = settings.webImages || {};

  const handleImageChange = (field: keyof WebImages, value: string) => {
    setSettings(produce(settings, draft => {
      if (!draft.webImages) draft.webImages = {};
      draft.webImages[field] = value;
    }));
  };

  const handleFileUpload = (field: keyof WebImages, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200; // Slightly larger for hero images

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          handleImageChange(field, compressedBase64);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const imageFields: { id: keyof WebImages; label: string; description: string }[] = [
    { id: 'logo', label: 'Logo del Restaurante', description: 'Se muestra en la barra de navegación y pie de página (si está configurado).' },
    { id: 'hero', label: 'Imagen Principal (Hero)', description: 'La imagen de fondo que se ve al entrar al sitio.' },
    { id: 'about', label: 'Imagen "Sobre Nosotros"', description: 'Imagen que acompaña la sección de historia del restaurante.' },
    { id: 'menu', label: 'Imagen Sección Menú', description: 'Fondo o imagen destacada para la sección de la carta.' },
    { id: 'reservation', label: 'Imagen Sección Reservas', description: 'Imagen que aparece junto al formulario de reservas.' },
    { id: 'events', label: 'Imagen Sección Eventos', description: 'Imagen que acompaña la sección de eventos exclusivos.' },
    { id: 'location', label: 'Imagen Sección Ubicación', description: 'Imagen de la fachada o ubicación del restaurante.' },
    { id: 'favicon', label: 'Favicon', description: 'Icono pequeño que aparece en la pestaña del navegador.' },
  ];

  return (
    <div className="space-y-8 animate-fadeInUp">
      <div className="flex items-center gap-3 bg-stone-900/20 p-4 rounded-lg border border-stone-800/50">
        <div className="p-2 bg-gold/10 rounded-lg">
          <Globe className="text-gold" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Imágenes del Sitio Web</h4>
          <p className="text-[10px] text-stone-500 uppercase tracking-widest">Personaliza la identidad visual de tu página</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {imageFields.map((field) => (
          <div key={field.id} className="bg-stone-900/40 border border-stone-800 rounded-xl p-6 space-y-4 hover:border-stone-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h5 className="text-white font-serif text-lg">{field.label}</h5>
                <p className="text-stone-500 text-xs mt-1">{field.description}</p>
              </div>
              {webImages[field.id] && (
                <button 
                  onClick={() => handleImageChange(field.id, '')}
                  className="p-1.5 text-stone-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex gap-4 items-start">
              <div className="relative w-24 h-24 rounded-xl bg-stone-950 border border-stone-800 overflow-hidden flex-shrink-0 group">
                {webImages[field.id] ? (
                  <img 
                    src={webImages[field.id]} 
                    alt={field.label} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-800">
                    <ImageIcon size={32} />
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <Upload size={20} className="text-white" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={e => handleFileUpload(field.id, e)}
                  />
                </label>
              </div>

              <div className="flex-grow space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">URL de la Imagen</label>
                <input 
                  type="text"
                  value={webImages[field.id] || ''}
                  onChange={e => handleImageChange(field.id, e.target.value)}
                  className="w-full bg-stone-950 text-stone-300 py-2 px-3 rounded-lg border border-stone-800 focus:border-gold outline-none text-xs"
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
                <p className="text-[8px] text-stone-600 uppercase tracking-tighter">Pega una URL o usa el botón de subida</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminImages;
