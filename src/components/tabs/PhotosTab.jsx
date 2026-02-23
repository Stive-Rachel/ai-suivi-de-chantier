import { useState, useCallback, useRef } from "react";
import Icon from "../ui/Icon";

/**
 * PhotosTab — gestion photos du chantier.
 * Upload drag & drop, grid thumbnails, lightbox, filtres.
 * Fonctionne en local (localStorage/memory) quand Supabase Storage n'est pas configure.
 */
export default function PhotosTab({ project, updateProject, supaSync }) {
  const [photos, setPhotos] = useState(project.photos || []);
  const [filterBat, setFilterBat] = useState("all");
  const [filterLot, setFilterLot] = useState("all");
  const [lightbox, setLightbox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const batiments = project.batiments || [];
  const lots = project.lots || [];

  const savePhotos = useCallback(
    (newPhotos) => {
      setPhotos(newPhotos);
      updateProject((p) => ({ ...p, photos: newPhotos }));
    },
    [updateProject]
  );

  const processFiles = useCallback(
    (files) => {
      const newPhotos = [];
      let processed = 0;

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} depasse 10 Mo et sera ignore.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const photo = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            name: file.name,
            dataUrl: e.target.result,
            batimentId: filterBat !== "all" ? filterBat : "",
            lotNumero: filterLot !== "all" ? filterLot : "",
            date: new Date().toISOString(),
            size: file.size,
          };
          newPhotos.push(photo);
          processed++;
          if (processed === files.length || newPhotos.length === Array.from(files).filter((f) => f.type.startsWith("image/")).length) {
            savePhotos([...photos, ...newPhotos]);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [photos, savePhotos, filterBat, filterLot]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  const deletePhoto = (photoId) => {
    if (!confirm("Supprimer cette photo ?")) return;
    savePhotos(photos.filter((p) => p.id !== photoId));
  };

  const updatePhotoMeta = (photoId, field, value) => {
    savePhotos(
      photos.map((p) => (p.id === photoId ? { ...p, [field]: value } : p))
    );
  };

  // Filter photos
  const filteredPhotos = photos.filter((p) => {
    if (filterBat !== "all" && p.batimentId !== filterBat) return false;
    if (filterLot !== "all" && p.lotNumero !== filterLot) return false;
    return true;
  });

  // Group by batiment
  const groupedPhotos = {};
  for (const photo of filteredPhotos) {
    const key = photo.batimentId || "non_class";
    if (!groupedPhotos[key]) groupedPhotos[key] = [];
    groupedPhotos[key].push(photo);
  }

  const getBatName = (id) => {
    if (!id || id === "non_class") return "Non classe";
    const bat = batiments.find((b) => b.id === id);
    return bat ? bat.name : id;
  };

  const formatSize = (bytes) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
    return (bytes / 1024).toFixed(0) + " Ko";
  };

  // Lightbox navigation
  const lightboxNav = (direction) => {
    if (!lightbox) return;
    const idx = filteredPhotos.findIndex((p) => p.id === lightbox.id);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < filteredPhotos.length) {
      setLightbox(filteredPhotos[newIdx]);
    }
  };

  return (
    <div style={{ animation: "slideInUp 0.4s ease both" }}>
      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <Icon name="filter" size={14} />
        <select
          className="filter-select"
          value={filterBat}
          onChange={(e) => setFilterBat(e.target.value)}
        >
          <option value="all">Tous les batiments</option>
          {batiments.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterLot}
          onChange={(e) => setFilterLot(e.target.value)}
        >
          <option value="all">Tous les lots</option>
          {lots.map((l) => (
            <option key={l.numero} value={l.numero}>
              {l.numero} - {l.nom}
            </option>
          ))}
        </select>
        <span className="filter-count">{filteredPhotos.length} photo(s)</span>
      </div>

      {/* Drop zone */}
      <div
        className={`photos-dropzone ${isDragging ? "photos-dropzone-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <div className="photos-dropzone-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="photos-dropzone-text">
          {isDragging ? "Deposer les photos ici" : "Glisser-deposer des photos ou cliquer pour selectionner"}
        </p>
        <p className="photos-dropzone-hint">JPG, PNG, WebP - Max 10 Mo par fichier</p>
      </div>

      {/* Photos grid grouped by batiment */}
      {filteredPhotos.length === 0 ? (
        <div className="empty-placeholder" style={{ marginTop: 14 }}>
          Aucune photo. Ajoutez des photos via le glisser-deposer ci-dessus.
        </div>
      ) : (
        Object.entries(groupedPhotos).map(([batId, groupPhotos]) => (
          <div key={batId} className="config-section" style={{ marginTop: 14 }}>
            <div className="section-header">
              <h3 style={{ fontSize: 14 }}>{getBatName(batId)}</h3>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {groupPhotos.length} photo(s)
              </span>
            </div>
            <div className="photos-grid">
              {groupPhotos.map((photo) => (
                <div key={photo.id} className="photo-card">
                  <div
                    className="photo-thumb"
                    onClick={() => setLightbox(photo)}
                  >
                    <img src={photo.dataUrl} alt={photo.name} loading="lazy" />
                  </div>
                  <div className="photo-meta">
                    <span className="photo-name" title={photo.name}>
                      {photo.name}
                    </span>
                    <div className="photo-actions">
                      <select
                        className="photo-select-mini"
                        value={photo.batimentId || ""}
                        onChange={(e) =>
                          updatePhotoMeta(photo.id, "batimentId", e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Batiment...</option>
                        {batiments.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="delete-btn"
                        style={{ opacity: 1, padding: 4 }}
                        onClick={() => deletePhoto(photo.id)}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                    <span className="photo-date">
                      {new Date(photo.date).toLocaleDateString("fr-FR")}
                      {photo.size ? ` \u00b7 ${formatSize(photo.size)}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="photos-lightbox"
          onClick={() => setLightbox(null)}
        >
          <div className="photos-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="photos-lightbox-close"
              onClick={() => setLightbox(null)}
            >
              <Icon name="x" size={24} />
            </button>
            <button
              className="photos-lightbox-nav photos-lightbox-prev"
              onClick={() => lightboxNav(-1)}
              disabled={filteredPhotos.findIndex((p) => p.id === lightbox.id) === 0}
            >
              <Icon name="back" size={24} />
            </button>
            <img
              src={lightbox.dataUrl}
              alt={lightbox.name}
              className="photos-lightbox-img"
            />
            <button
              className="photos-lightbox-nav photos-lightbox-next"
              onClick={() => lightboxNav(1)}
              disabled={filteredPhotos.findIndex((p) => p.id === lightbox.id) === filteredPhotos.length - 1}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="photos-lightbox-info">
              <span>{lightbox.name}</span>
              <span>{new Date(lightbox.date).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
