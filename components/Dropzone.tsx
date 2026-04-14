"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Video, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (files: File[]) => void;
  isPro: boolean;
  className?: string;
}

const ACCEPTED_TYPES = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/x-msvideo": [".avi"],
  "video/webm": [".webm"],
  "video/x-matroska": [".mkv"],
};

export default function Dropzone({ onFileSelect, isPro, className }: DropzoneProps) {
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: import("react-dropzone").FileRejection[]) => {
      setRejectedMsg(null);

      if (accepted.length > 0) {
        if (!isPro && accepted.length > 1) {
          setRejectedMsg("Upgrade to Pro to queue multiple videos at once. Analyzing first video only.");
          onFileSelect([accepted[0]]);
        } else {
          onFileSelect(accepted);
        }
      } else if (rejected.length > 0) {
        setRejectedMsg("Unsupported file type. Please upload MP4, MOV, AVI, WebM, or MKV.");
      }
    },
    [onFileSelect, isPro]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_TYPES,
      multiple: true,
      maxSize: 4 * 1024 * 1024 * 1024, // 4 GB
    });

  const isError = isDragReject || !!rejectedMsg;

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden transition-all duration-200 select-none",
          "min-h-[320px]",
          isDragActive && !isError
            ? "border-violet-500 bg-violet-950/20 scale-[1.01]"
            : isError
            ? "border-red-500/60 bg-red-950/10"
            : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500 hover:bg-zinc-900",
          className
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-5 text-center px-8 py-10 pointer-events-none">
          {/* Icon */}
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
              isDragActive && !isError
                ? "bg-violet-600 text-white scale-110"
                : isError
                ? "bg-red-900/40 text-red-400"
                : "bg-zinc-800 text-zinc-400"
            )}
          >
            {isDragActive ? (
              <Film className="w-8 h-8" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-white">
              {isDragActive && !isError
                ? "Release to upload"
                : "Drop your video here"}
            </h2>
            <p className="text-sm text-zinc-400">
              or{" "}
              <span className="text-violet-400 font-medium underline underline-offset-2">
                click to browse
              </span>
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              MP4, MOV, AVI, WebM, MKV · up to 4 GB
            </p>
          </div>

          {/* Privacy badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-[11px] text-zinc-500">
            <Video className="w-3 h-3" />
            <span>Processed locally — never uploaded</span>
          </div>
        </div>
      </div>

      {rejectedMsg && (
        <p className="text-xs text-red-400 text-center">{rejectedMsg}</p>
      )}
    </div>
  );
}