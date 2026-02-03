import React from 'react';

const VideoPlaceholder = () => (
  <div className="video-placeholder bg-white rounded-lg shadow-md overflow-hidden mb-4 animate-pulse">
    <div className="thumbnail-placeholder w-full h-48 bg-gray-200"></div>
    <div className="info-placeholder p-4">
      <div className="title-placeholder h-4 bg-gray-200 rounded mb-2"></div>
      <div className="channel-placeholder h-3 bg-gray-200 rounded w-3/4"></div>
    </div>
  </div>
);

export default VideoPlaceholder;