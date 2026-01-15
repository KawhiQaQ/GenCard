interface DownloadButtonProps {
  imageUrl: string;
  /** 自定义下载文件名 */
  filename?: string;
}

function DownloadButton({ imageUrl, filename }: DownloadButtonProps) {
  const handleDownload = async () => {
    try {
      // 从URL中提取图片ID
      const urlParts = imageUrl.split('/');
      const urlFilename = urlParts[urlParts.length - 1];
      const imageId = urlFilename.split('.')[0];
      
      // 使用下载API
      const downloadUrl = `/api/download/${imageId}`;
      
      // 创建隐藏的a标签触发下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || `card-${imageId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      // 如果API下载失败，回退到直接使用imageUrl
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename || 'card.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="flex-1 px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium"
    >
      下载卡牌
    </button>
  );
}

export default DownloadButton;
