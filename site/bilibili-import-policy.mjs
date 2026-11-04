// The published catalog is edited content, not disposable API output. A repeat
// import may add reviewed uploads; it must never flatten collections or revive
// a removed upload.
export function planBilibiliImport(catalog, videos, policy) {
  if (policy.version !== 1 || !Array.isArray(policy.approvedPersonalBvids))
    throw new Error('Unsupported or incomplete Bilibili import policy');
  const media = new Map(catalog.media.map((item) => [item.id, item]));
  const works = new Map(catalog.works.map((item) => [item.id, item]));
  const represented = new Map();
  for (const work of catalog.works) {
    for (const id of [work.mediaId, ...(work.videos || []).map((v) => v.mediaId)]) {
      const item = media.get(id);
      if (item?.kind === 'embed') represented.set(item.bvid, work.id);
    }
  }
  for (const [bvid, workId] of Object.entries(policy.canonicalWorks || {})) {
    if (!works.has(workId) || represented.get(bvid) !== workId)
      throw new Error(`Import policy/catalog disagree: ${bvid} must belong to ${workId}`);
  }
  const pending = [], skipped = [];
  const seen = new Set();
  for (const video of videos) {
    if (seen.has(video.bvid)) continue;
    seen.add(video.bvid);
    const reason = policy.excluded?.[video.bvid];
    if (reason) {
      if (represented.has(video.bvid)) throw new Error(`Excluded upload is still active: ${video.bvid}`);
      skipped.push({ bvid: video.bvid, reason });
    } else if (represented.has(video.bvid)) {
      skipped.push({ bvid: video.bvid, reason: `Already curated in ${represented.get(video.bvid)}` });
    } else if (String(video.owner?.mid) === policy.clubMid ||
      (String(video.owner?.mid) === policy.personalMid && policy.approvedPersonalBvids.includes(video.bvid))) {
      pending.push(video);
    } else {
      skipped.push({ bvid: video.bvid, reason: 'Needs explicit scope review' });
    }
  }
  return { pending, skipped };
}

export function appendImportedContent(catalog, additions) {
  const result = { ...catalog };
  for (const name of ['works', 'sources', 'media']) {
    const existing = new Set(catalog[name].map((item) => item.id));
    result[name] = [...catalog[name]];
    for (const item of additions[name]) {
      if (existing.has(item.id)) continue;
      result[name].push(item);
      existing.add(item.id);
    }
  }
  return result;
}
