import React, { useState } from 'react';
import ReservationFlow from './ReservationFlow';
import { WebImages } from '../types';

interface ReservationPageProps {
  webImages?: WebImages;
}

const ReservationPage: React.FC<ReservationPageProps> = ({ webImages }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBackClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.hash = '/';
  };

  return (
    <div className="bg-luxury-black text-white flex flex-col min-h-[100dvh]">
      {/* Contenido Principal */}
      <main className="flex-grow p-4 sm:p-6 pb-32 max-w-2xl mx-auto w-full">
        <ReservationFlow 
          onSubmittingChange={setIsSubmitting} 
          webImages={webImages}
        />
      </main>
    </div>
  );
};

export default ReservationPage;
