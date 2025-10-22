import React, { useState, useRef } from 'react';
import { Upload, X, Check, Loader, FileText } from 'lucide-react';

interface PDFUploaderProps {
  onUploadComplete: (path: string, publicUrl: string, fileSize: number) => void;
  uploadFunction: (file: File, fileName: string) => Promise<{ data: { path: string; publicUrl: string } | null; error: string | null }>;
  currentPdfUrl?: string;
  currentFileName?: string;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  onUploadComplete,
  uploadFunction,
  currentPdfUrl,
  currentFileName,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setUploadSuccess(false);
      } else {
        alert('Please select a PDF file');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const fileName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '-')}`;

      // Actually upload to Supabase Storage
      const result = await uploadFunction(selectedFile, fileName);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        onUploadComplete(result.data.path, result.data.publicUrl, selectedFile.size);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadSuccess(true);

      setTimeout(() => {
        setSelectedFile(null);
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setUploadProgress(0);
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
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        alert('Please select a PDF file');
      }
    }
  };

  return (
    <div className="space-y-4">
      {!selectedFile && (
        <div>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop a PDF here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Maximum file size: 50 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={onSelectFile}
              className="hidden"
            />
          </div>
          {currentPdfUrl && currentFileName && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Current PDF:</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {currentFileName}
                  </span>
                </div>
                <a
                  href={currentPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-primary hover:text-brand-d-blue"
                >
                  View PDF
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedFile && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-brand-primary" />
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
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
              disabled={uploading}
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
                  Upload PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
