import { Progress } from './progress';

interface UploadProgressProps {
  progress: number;
  label: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  fileCount: number;
  uploadedCount: number;
}

export function UploadProgress({ 
  progress, 
  label, 
  status, 
  fileCount,
  uploadedCount 
}: UploadProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {uploadedCount} / {fileCount}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      {status === 'uploading' && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Uploading in progress...
        </p>
      )}
    </div>
  );
}