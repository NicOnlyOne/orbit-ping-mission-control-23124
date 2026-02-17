import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, User, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  onAvatarChange: (avatarUrl: string | null) => void;
  className?: string;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function AvatarUpload({ userId, currentAvatarUrl, onAvatarChange, className }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setCropDialogOpen(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  const getCroppedBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = imgRef.current;
      if (!image || !crop) {
        reject(new Error('No image or crop data'));
        return;
      }

      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const pixelCrop = {
        x: (crop.unit === '%' ? (crop.x / 100) * image.width : crop.x) * scaleX,
        y: (crop.unit === '%' ? (crop.y / 100) * image.height : crop.y) * scaleY,
        width: (crop.unit === '%' ? (crop.width / 100) * image.width : crop.width) * scaleX,
        height: (crop.unit === '%' ? (crop.height / 100) * image.height : crop.height) * scaleY,
      };

      const size = Math.min(pixelCrop.width, pixelCrop.height, 512);
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        0.9
      );
    });
  }, [crop]);

  const handleCropConfirm = async () => {
    try {
      setUploading(true);
      const blob = await getCroppedBlob();
      const fileName = `${Math.random()}.jpeg`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: userId, avatar_url: avatarUrl }, { onConflict: 'id' });

      if (updateError) throw updateError;

      onAvatarChange(avatarUrl);
      setCropDialogOpen(false);
      setImgSrc('');
      toast({ title: "Success", description: "Avatar updated successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploading(true);
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, avatar_url: null }, { onConflict: 'id' });
      if (error) throw error;
      onAvatarChange(null);
      toast({ title: "Success", description: "Avatar removed successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={currentAvatarUrl} alt="Profile avatar" className="object-cover" />
          <AvatarFallback className="text-xl">
            <User className="h-8 w-8" />
          </AvatarFallback>
        </Avatar>
        {currentAvatarUrl && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 rounded-full p-1 h-6 w-6"
            onClick={removeAvatar}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Avatar"}
        </Button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onSelectFile}
        accept="image/*"
        className="hidden"
      />

      <Dialog open={cropDialogOpen} onOpenChange={(open) => { if (!uploading) setCropDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Avatar</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  className="max-h-[400px]"
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleCropConfirm} disabled={uploading}>
              <Check className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Save Avatar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
