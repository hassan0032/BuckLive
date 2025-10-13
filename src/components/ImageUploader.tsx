import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check, Loader } from 'lucide-react';

interface ImageUploaderProps {
  onUploadComplete: (path: string, publicUrl: string) => void;
  currentImageUrl?: string;
  aspectRatio?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUploadComplete,
  currentImageUrl,
  aspectRatio = 16 / 9,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
      setUploadSuccess(false);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropWidth = width;
    const cropHeight = width / aspectRatio;

    const crop: Crop = {
      unit: 'px',
      width: cropWidth,
      height: Math.min(cropHeight, height),
      x: 0,
      y: Math.max(0, (height - cropHeight) / 2),
    };
    setCrop(crop);
  }, [aspectRatio]);

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return Promise.reject(new Error('No 2d context'));
      }

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          0.9
        );
      });
    },
    []
  );

  const handleUpload = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) return;

    try {
      setUploading(true);
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);

      const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '-')}`;

      onUploadComplete(fileName, '');

      setUploadSuccess(true);
      setTimeout(() => {
        setImageSrc('');
        setSelectedFile(null);
        setUploadSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setImageSrc('');
    setSelectedFile(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          setImageSrc(reader.result?.toString() || '');
        });
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="space-y-4">
      {!imageSrc && (
        <div>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Image will be cropped to 16:9 aspect ratio
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onSelectFile}
              className="hidden"
            />
          </div>
          {currentImageUrl && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Current thumbnail:</p>
              <img
                src={currentImageUrl}
                alt="Current thumbnail"
                className="w-full max-w-md rounded-lg shadow-sm"
              />
            </div>
          )}
        </div>
      )}

      {imageSrc && (
        <div className="space-y-4">
          <div className="max-w-full overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-w-full"
              />
            </ReactCrop>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 uppercase font-bold"
            >
              <X className="h-4 w-4 inline mr-2" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !completedCrop}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors disabled:opacity-50 flex items-center uppercase font-bold text-sm"
            >
              {uploading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : uploadSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Uploaded!
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
