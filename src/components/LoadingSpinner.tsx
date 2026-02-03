import React from 'react';

const LoadingSpinner = () => (
  <div className="loading-placeholder flex flex-col items-center justify-center py-10">
    <div className="spinner w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-gray-600">Chargement...</p>
  </div>
);

export default LoadingSpinner;