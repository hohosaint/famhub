import { createElement, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { api } from './api';
import { colors } from './theme';
import { Icon } from './ui';

export type Photo = { id: string; name: string };

// "Take photo" opens the phone camera (on a PC it opens the file chooser);
// "Choose photos" opens the photo library and allows several at once.
export function PhotoCapture({ cid, photos, setPhotos, max = 6, big = false, onError }: {
  cid: string; photos: Photo[]; setPhotos: (p: Photo[]) => void; max?: number; big?: boolean; onError: (m: string | null) => void;
}) {
  const camera = useRef<HTMLInputElement | null>(null);
  const library = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(0);
  const latest = useRef(photos);
  latest.current = photos;
  if (Platform.OS !== 'web') return null;

  async function add(files: FileList | null) {
    const list = Array.from(files || []).slice(0, Math.max(0, max - latest.current.length));
    if (!list.length) { if (files?.length) onError(`You can add up to ${max} photos.`); return; }
    onError(null);
    setBusy(list.length);
    for (const f of list) {
      try {
        const p = await api.upload(cid, f);
        latest.current = [...latest.current, p];
        setPhotos(latest.current);
      } catch (e: any) { onError(e.message); }
      setBusy((b) => b - 1);
    }
  }

  const full = photos.length >= max;
  const btn = (label: string, icon: 'camera' | 'images', onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!!busy || full} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: big ? 150 : 130, flexDirection: big ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: big ? 6 : 8,
        paddingVertical: big ? 22 : 12, paddingHorizontal: 12, borderRadius: big ? 20 : 14, borderWidth: 1.5, borderColor: colors.primary,
        backgroundColor: pressed ? colors.primarySoft : colors.card, opacity: busy || full ? 0.5 : 1 })}>
      <Icon name={icon} size={big ? 44 : 22} color={colors.primary} />
      <Text style={{ fontSize: big ? 24 : 16, fontWeight: '700', color: colors.primary, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {btn('Take photo', 'camera', () => camera.current?.click())}
        {btn(big ? 'Choose photo' : 'Choose photos', 'images', () => library.current?.click())}
      </View>
      {createElement('input', { ref: camera, type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Take photo with camera', style: { display: 'none' }, onChange: (e: any) => { add(e.target.files); e.target.value = ''; } })}
      {createElement('input', { ref: library, type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Choose photos from library', style: { display: 'none' }, onChange: (e: any) => { add(e.target.files); e.target.value = ''; } })}
      {(photos.length > 0 || busy > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p) => (
            <View key={p.id}>
              <Image source={{ uri: api.fileUrl(p.id) }} style={{ width: big ? 110 : 84, height: big ? 110 : 84, borderRadius: 12, backgroundColor: colors.surfaceAlt2 }} accessibilityLabel={`Photo ${p.name}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => setPhotos(photos.filter((x) => x.id !== p.id))}
                style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card }}>
                <Icon name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          {Array.from({ length: busy }).map((_, i) => (
            <View key={`b${i}`} style={{ width: big ? 110 : 84, height: big ? 110 : 84, borderRadius: 12, backgroundColor: colors.surfaceAlt2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Uploading...</Text>
            </View>
          ))}
        </View>
      )}
      {!big && <Text style={{ color: colors.faint, fontSize: 13 }}>{photos.length}/{max} photos. Photos are resized before upload.</Text>}
    </View>
  );
}

// Photos in an update: one large photo, or a grid of squares. Tap to view full size.
export function PhotoGrid({ ids, height = 240 }: { ids: string[]; height?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!ids.length) return null;
  const one = ids.length === 1;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 12, overflow: 'hidden' }}>
        {ids.map((id, i) => (
          <Pressable key={id} onPress={() => setOpen(i)} accessibilityRole="button" accessibilityLabel={`Open photo ${i + 1} of ${ids.length}`}
            style={{ width: one ? '100%' : ids.length === 3 && i === 0 ? '100%' : '49.4%', height: one ? height : ids.length === 3 && i === 0 ? height * 0.7 : height * 0.6 }}>
            <Image source={{ uri: api.fileUrl(id) }} style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceAlt2 }} resizeMode="cover" />
          </Pressable>
        ))}
      </View>
      {open !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
            <Image source={{ uri: api.fileUrl(ids[open]) }} style={{ width: '100%', height: '80%' }} resizeMode="contain" accessibilityLabel={`Photo ${open + 1} of ${ids.length}`} />
            <View style={{ position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{open + 1} / {ids.length}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable accessibilityRole="link" accessibilityLabel="Download photo" onPress={() => { window.open(`${api.fileUrl(ids[open])}${api.fileUrl(ids[open]).includes('?') ? '&' : '?'}download=1`, '_blank'); }} style={{ padding: 8 }}><Icon name="download-outline" size={26} color="#fff" /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setOpen(null)} style={{ padding: 8 }}><Icon name="close" size={28} color="#fff" /></Pressable>
              </View>
            </View>
            {ids.length > 1 && (
              <View style={{ position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 40 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => setOpen((open + ids.length - 1) % ids.length)} style={{ padding: 12 }}><Icon name="chevron-back" size={34} color="#fff" /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => setOpen((open + 1) % ids.length)} style={{ padding: 12 }}><Icon name="chevron-forward" size={34} color="#fff" /></Pressable>
              </View>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

// Existing photo ids as picker items (for editing something that already has photos).
export const asPhotos = (ids?: string[]): Photo[] => (ids || []).map((id, i) => ({ id, name: `photo ${i + 1}` }));

// Photos and documents together (for visit notes): take a photo, choose photos, or attach a PDF or file.
export type Attachment = { id: string; name: string; type: string };
export function AttachmentPicker({ cid, items, setItems, max = 12, onError }: { cid: string; items: Attachment[]; setItems: (a: Attachment[]) => void; max?: number; onError: (m: string | null) => void }) {
  const docInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(0);
  const latest = useRef(items);
  latest.current = items;
  const photos = items.filter((a) => a.type.startsWith('image/'));
  const docs = items.filter((a) => !a.type.startsWith('image/'));
  if (Platform.OS !== 'web') return null;

  async function addDocs(files: FileList | null) {
    const list = Array.from(files || []).slice(0, Math.max(0, max - latest.current.length));
    onError(null);
    setBusy(list.length);
    for (const f of list) {
      try { const r = await api.upload(cid, f); latest.current = [...latest.current, { id: r.id, name: r.name, type: r.type || f.type }]; setItems(latest.current); } catch (e: any) { onError(e.message); }
      setBusy((b) => b - 1);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <PhotoCapture cid={cid} photos={photos} max={max - docs.length} onError={onError}
        setPhotos={(ps) => { const next = [...ps.map((p) => ({ id: p.id, name: p.name, type: (p as any).type || 'image/jpeg' })), ...latest.current.filter((a) => !a.type.startsWith('image/'))]; latest.current = next; setItems(next); }} />
      <Pressable onPress={() => docInput.current?.click()} disabled={!!busy || items.length >= max} accessibilityRole="button" accessibilityLabel="Attach a document or file"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: pressed ? colors.primarySoft : colors.card, opacity: busy || items.length >= max ? 0.5 : 1 })}>
        <Icon name="document-attach-outline" size={22} color={colors.primary} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{busy ? 'Uploading...' : 'Attach a document (PDF) or file'}</Text>
      </Pressable>
      {createElement('input', { ref: docInput, type: 'file', accept: 'application/pdf,image/*', multiple: true, 'aria-label': 'Attach documents', style: { display: 'none' }, onChange: (e: any) => { addDocs(e.target.files); e.target.value = ''; } })}
      {docs.map((d) => (
        <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
          <Icon name="document-text-outline" size={22} color={colors.danger} />
          <Text style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>{d.name}</Text>
          <Pressable onPress={() => { const next = latest.current.filter((x) => x.id !== d.id); latest.current = next; setItems(next); }} accessibilityRole="button" accessibilityLabel={`Remove ${d.name}`}><Icon name="close-circle" size={22} color={colors.faint} /></Pressable>
        </View>
      ))}
    </View>
  );
}

// Show attachments: photos as a grid, documents as rows that open the file.
export function AttachmentList({ files }: { files: Attachment[] }) {
  const photos = files.filter((f) => f.type.startsWith('image/')).map((f) => f.id);
  const docs = files.filter((f) => !f.type.startsWith('image/'));
  return (
    <View style={{ gap: 8 }}>
      <PhotoGrid ids={photos} height={180} />
      {docs.map((d) => (
        <Pressable key={d.id} onPress={() => window.open(api.fileUrl(d.id), '_blank')} accessibilityRole="link" accessibilityLabel={`Open ${d.name}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
          <Icon name="document-text-outline" size={22} color={colors.danger} />
          <Text style={{ flex: 1, fontSize: 15, color: colors.text }} numberOfLines={1}>{d.name}</Text>
          <Icon name="open-outline" size={18} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}
