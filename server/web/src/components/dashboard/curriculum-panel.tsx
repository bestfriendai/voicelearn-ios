'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Image,
  Plus,
  Trash2,
  Edit3,
  Save,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Upload,
  X,
  Check,
  AlertCircle,
  FileImage,
  Link2,
  Eye,
} from 'lucide-react';
import {
  getCurricula,
  getCurriculumDetail,
  saveCurriculum,
  uploadVisualAsset,
  deleteVisualAsset,
  reloadCurricula,
} from '@/lib/api-client';
import type {
  CurriculumSummary,
  CurriculumTopic,
  VisualAsset,
  MediaCollection,
  VisualAssetType,
  VisualDisplayMode,
} from '@/types';

// =============================================================================
// Curriculum List Component
// =============================================================================

interface CurriculumListProps {
  curricula: CurriculumSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReload: () => void;
  isLoading: boolean;
}

function CurriculumList({
  curricula,
  selectedId,
  onSelect,
  onReload,
  isLoading,
}: CurriculumListProps) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-orange-400" />
          Curricula
        </h3>
        <button
          onClick={onReload}
          disabled={isLoading}
          className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          title="Reload curricula from disk"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {curricula.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No curricula found
          </div>
        ) : (
          curricula.map((curriculum) => (
            <button
              key={curriculum.id}
              onClick={() => onSelect(curriculum.id)}
              className={cn(
                'w-full p-4 text-left border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors',
                selectedId === curriculum.id && 'bg-slate-700/50 border-l-2 border-l-orange-400'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">
                    {curriculum.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {curriculum.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{curriculum.topicCount} topics</span>
                    {curriculum.hasVisualAssets && (
                      <span className="flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        {curriculum.visualAssetCount} visuals
                      </span>
                    )}
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] uppercase',
                        curriculum.status === 'final'
                          ? 'bg-green-500/20 text-green-400'
                          : curriculum.status === 'draft'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                      )}
                    >
                      {curriculum.status}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Topic List Component
// =============================================================================

interface TopicListProps {
  topics: CurriculumTopic[];
  selectedTopicId: string | null;
  onSelect: (id: string) => void;
}

function TopicList({ topics, selectedTopicId, onSelect }: TopicListProps) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-sm font-medium text-white">Topics</h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {topics.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No topics in this curriculum
          </div>
        ) : (
          topics.map((topic, index) => {
            const assetCount =
              (topic.media?.embedded?.length || 0) + (topic.media?.reference?.length || 0);
            return (
              <button
                key={topic.id.value}
                onClick={() => onSelect(topic.id.value)}
                className={cn(
                  'w-full p-3 text-left border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors',
                  selectedTopicId === topic.id.value && 'bg-slate-700/50 border-l-2 border-l-orange-400'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded text-xs text-slate-300">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-white truncate">{topic.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {topic.transcript && (
                        <span>{topic.transcript.segments?.length || 0} segments</span>
                      )}
                      {assetCount > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <Image className="w-3 h-3" />
                          {assetCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Visual Asset Card Component
// =============================================================================

interface VisualAssetCardProps {
  asset: VisualAsset;
  isReference: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function VisualAssetCard({ asset, isReference, onEdit, onDelete }: VisualAssetCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  const displayModeColors: Record<VisualDisplayMode, string> = {
    persistent: 'bg-blue-500/20 text-blue-400',
    highlight: 'bg-yellow-500/20 text-yellow-400',
    popup: 'bg-purple-500/20 text-purple-400',
    inline: 'bg-green-500/20 text-green-400',
  };

  const typeIcons: Record<VisualAssetType, typeof Image> = {
    image: FileImage,
    diagram: FileImage,
    equation: FileImage,
    chart: FileImage,
    slideImage: FileImage,
    slideDeck: FileImage,
    generated: FileImage,
  };

  const TypeIcon = typeIcons[asset.type] || FileImage;

  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600/50 overflow-hidden">
      {/* Preview Image */}
      <div className="relative aspect-video bg-slate-800 flex items-center justify-center">
        {asset.url ? (
          <img
            src={asset.url}
            alt={asset.alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <TypeIcon className="w-12 h-12 text-slate-600" />
        )}
        {/* Overlay buttons */}
        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {asset.url && (
            <button
              onClick={() => setShowPreview(true)}
              className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4 text-white" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Asset Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-white truncate">
          {asset.title || asset.id}
        </h4>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
          {asset.alt}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="px-1.5 py-0.5 bg-slate-600/50 rounded text-[10px] text-slate-300">
            {asset.type}
          </span>
          {isReference ? (
            <span className="px-1.5 py-0.5 bg-orange-500/20 rounded text-[10px] text-orange-400">
              Reference
            </span>
          ) : (
            asset.segmentTiming && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px]',
                  displayModeColors[asset.segmentTiming.displayMode]
                )}
              >
                {asset.segmentTiming.displayMode}
              </span>
            )
          )}
          {asset.segmentTiming && !isReference && (
            <span className="text-[10px] text-slate-500">
              Seg {asset.segmentTiming.startSegment}-{asset.segmentTiming.endSegment}
            </span>
          )}
        </div>
      </div>

      {/* Full-screen preview modal */}
      {showPreview && asset.url && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          onClick={() => setShowPreview(false)}
        >
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={asset.url}
            alt={asset.alt}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Asset Upload Form Component
// =============================================================================

interface AssetUploadFormProps {
  onUpload: (
    file: File,
    metadata: {
      type: VisualAssetType;
      title: string;
      alt: string;
      caption: string;
      displayMode: VisualDisplayMode;
      startSegment: number;
      endSegment: number;
      isReference: boolean;
      keywords: string[];
    }
  ) => Promise<void>;
  onCancel: () => void;
  segmentCount: number;
}

function AssetUploadForm({ onUpload, onCancel, segmentCount }: AssetUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<VisualAssetType>('image');
  const [title, setTitle] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [displayMode, setDisplayMode] = useState<VisualDisplayMode>('inline');
  const [startSegment, setStartSegment] = useState(0);
  const [endSegment, setEndSegment] = useState(0);
  const [isReference, setIsReference] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create preview URL
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
      // Auto-detect type from mime
      if (selectedFile.type.includes('svg')) {
        setType('diagram');
      } else if (selectedFile.type.includes('image')) {
        setType('image');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !alt) return;

    setIsSubmitting(true);
    try {
      await onUpload(file, {
        type,
        title,
        alt,
        caption,
        displayMode,
        startSegment,
        endSegment,
        isReference,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/80 rounded-lg border border-slate-700/50 p-6">
      <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-orange-400" />
        Upload Visual Asset
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Image File</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600"
          />
          {preview && (
            <div className="mt-3 relative aspect-video w-48 bg-slate-900 rounded-lg overflow-hidden">
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Asset Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as VisualAssetType)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="image">Image</option>
            <option value="diagram">Diagram</option>
            <option value="chart">Chart</option>
            <option value="equation">Equation</option>
            <option value="slideImage">Slide Image</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Descriptive title"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* Alt Text (Required) */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Alt Text <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            required
            placeholder="Accessibility description (required)"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Caption</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Display caption"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        {/* Reference vs Embedded */}
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isReference}
              onChange={(e) => setIsReference(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
            />
            Reference Asset (user-requestable, not synced to playback)
          </label>
        </div>

        {/* Embedded-specific options */}
        {!isReference && (
          <>
            {/* Display Mode */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Display Mode</label>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as VisualDisplayMode)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="inline">Inline (embedded in transcript)</option>
                <option value="persistent">Persistent (stays on screen)</option>
                <option value="highlight">Highlight (appears then fades)</option>
                <option value="popup">Popup (dismissible overlay)</option>
              </select>
            </div>

            {/* Segment Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Start Segment</label>
                <input
                  type="number"
                  min={0}
                  max={segmentCount - 1}
                  value={startSegment}
                  onChange={(e) => setStartSegment(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">End Segment</label>
                <input
                  type="number"
                  min={startSegment}
                  max={segmentCount - 1}
                  value={endSegment}
                  onChange={(e) => setEndSegment(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </>
        )}

        {/* Keywords (for reference assets) */}
        {isReference && (
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="search, terms, for, matching"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={!file || !alt || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// =============================================================================
// Visual Assets Editor Component
// =============================================================================

interface VisualAssetsEditorProps {
  topic: CurriculumTopic | null;
  curriculumId: string;
  onAssetsChanged: () => void;
}

function VisualAssetsEditor({ topic, curriculumId, onAssetsChanged }: VisualAssetsEditorProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!topic) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-8 text-center text-slate-500">
        <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select a topic to manage visual assets</p>
      </div>
    );
  }

  const embeddedAssets = topic.media?.embedded || [];
  const referenceAssets = topic.media?.reference || [];
  const segmentCount = topic.transcript?.segments?.length || 10;

  const handleUpload = async (
    file: File,
    metadata: {
      type: VisualAssetType;
      title: string;
      alt: string;
      caption: string;
      displayMode: VisualDisplayMode;
      startSegment: number;
      endSegment: number;
      isReference: boolean;
      keywords: string[];
    }
  ) => {
    await uploadVisualAsset(curriculumId, topic.id.value, file, metadata);
    setShowUploadForm(false);
    onAssetsChanged();
  };

  const handleDelete = async (assetId: string) => {
    await deleteVisualAsset(curriculumId, topic.id.value, assetId);
    setDeleteConfirm(null);
    onAssetsChanged();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Image className="w-5 h-5 text-orange-400" />
          Visual Assets: {topic.title}
        </h3>
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <AssetUploadForm
          onUpload={handleUpload}
          onCancel={() => setShowUploadForm(false)}
          segmentCount={segmentCount}
        />
      )}

      {/* Embedded Assets */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          Embedded Assets ({embeddedAssets.length})
          <span className="text-xs text-slate-500 font-normal">
            Synced with playback
          </span>
        </h4>
        {embeddedAssets.length === 0 ? (
          <div className="bg-slate-800/30 rounded-lg p-6 text-center text-slate-500 text-sm">
            No embedded assets. Add images that display during specific segments.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {embeddedAssets.map((asset) => (
              <VisualAssetCard
                key={asset.id}
                asset={asset}
                isReference={false}
                onEdit={() => {
                  // TODO: Open edit modal
                }}
                onDelete={() => setDeleteConfirm(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reference Assets */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-400 rounded-full" />
          Reference Assets ({referenceAssets.length})
          <span className="text-xs text-slate-500 font-normal">
            User-requestable
          </span>
        </h4>
        {referenceAssets.length === 0 ? (
          <div className="bg-slate-800/30 rounded-lg p-6 text-center text-slate-500 text-sm">
            No reference assets. Add supplementary images users can request.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {referenceAssets.map((asset) => (
              <VisualAssetCard
                key={asset.id}
                asset={asset}
                isReference={true}
                onEdit={() => {
                  // TODO: Open edit modal
                }}
                onDelete={() => setDeleteConfirm(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-2">Delete Asset?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This will permanently remove the asset from this topic. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Curriculum Panel Component
// =============================================================================

export function CurriculumPanel() {
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedTopic = topics.find((t) => t.id.value === selectedTopicId) || null;

  // Load curricula on mount
  useEffect(() => {
    loadCurricula();
  }, []);

  // Load topics when curriculum selected
  useEffect(() => {
    if (selectedCurriculumId) {
      loadCurriculumDetail(selectedCurriculumId);
    } else {
      setTopics([]);
      setSelectedTopicId(null);
    }
  }, [selectedCurriculumId]);

  const loadCurricula = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCurricula();
      setCurricula(response.curricula);
    } catch (err) {
      setError('Failed to load curricula');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurriculumDetail = async (id: string) => {
    try {
      const response = await getCurriculumDetail(id);
      const content = response.curriculum.document.content?.[0];
      if (content?.children) {
        setTopics(content.children);
      } else {
        setTopics([]);
      }
    } catch (err) {
      console.error('Failed to load curriculum detail:', err);
      setTopics([]);
    }
  };

  const handleReload = async () => {
    setIsLoading(true);
    try {
      await reloadCurricula();
      await loadCurricula();
    } catch (err) {
      console.error('Failed to reload curricula:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetsChanged = () => {
    if (selectedCurriculumId) {
      loadCurriculumDetail(selectedCurriculumId);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-orange-400" />
            Curriculum Editor
          </h2>
          <p className="text-slate-400 mt-1">
            Manage curriculum content and visual assets
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Curriculum & Topic Lists */}
          <div className="lg:col-span-4 space-y-6">
            <CurriculumList
              curricula={curricula}
              selectedId={selectedCurriculumId}
              onSelect={setSelectedCurriculumId}
              onReload={handleReload}
              isLoading={isLoading}
            />

            {selectedCurriculumId && (
              <TopicList
                topics={topics}
                selectedTopicId={selectedTopicId}
                onSelect={setSelectedTopicId}
              />
            )}
          </div>

          {/* Right Column: Visual Assets Editor */}
          <div className="lg:col-span-8">
            <VisualAssetsEditor
              topic={selectedTopic}
              curriculumId={selectedCurriculumId || ''}
              onAssetsChanged={handleAssetsChanged}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
