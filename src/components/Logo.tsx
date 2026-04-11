import React from 'react';

const Logo = ({ className = "w-64 h-64" }) => {
  return (
    <div className={`relative flex flex-col items-center justify-center bg-[#f8f9f5] p-8 border border-gray-100 ${className}`}>
      {/* The House Roof */}
      <div className="absolute top-10 w-full h-full border-t-[12px] border-l-[12px] border-[#7b6a6c] rotate-45 scale-[0.6] rounded-tl-lg"></div>
      
      {/* Walls */}
      <div className="absolute bottom-10 left-12 w-[10px] h-32 bg-[#7b6a6c] rounded-full"></div>
      <div className="absolute bottom-10 right-12 w-[10px] h-32 bg-[#7b6a6c] rounded-full"></div>

      {/* Circle Icon */}
      <div className="z-10 bg-[#7b6a6c] rounded-full p-2 mb-2 flex space-x-1">
         <span className="text-white text-xs">🍴</span>
      </div>

      {/* Typography */}
      <div className="z-10 text-center text-[#7b6a6c] font-serif">
        <h1 className="text-6xl font-black leading-tight tracking-tight">AJ's</h1>
        <h1 className="text-5xl font-black leading-tight tracking-tight -mt-2">Café</h1>
      </div>

      {/* Location Footer */}
      <p className="mt-4 text-[10px] uppercase tracking-[0.2em] font-sans font-bold text-[#7b6a6c]">
        Laligan, Valencia, Bukidnon, Mindanao
      </p>
    </div>
  );
};

export default Logo;
