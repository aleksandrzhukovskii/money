const FOLDER_NAME = 'MoneyTracker'
const FILE_NAME = 'money-tracker.enc'

export async function getOrCreateSyncFolder(accessToken: string): Promise<string> {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then((r) => r.json())

  if (list.files?.length > 0) {
    return list.files[0].id
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  }).then((r) => r.json())

  return res.id
}

export async function uploadFile(
  encryptedData: Uint8Array,
  folderId: string,
  accessToken: string,
): Promise<string> {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then((r) => r.json())

  const metadata = JSON.stringify({
    name: FILE_NAME,
    ...(list.files?.length > 0 ? {} : { parents: [folderId] }),
  })

  const form = new FormData()
  form.append('metadata', new Blob([metadata], { type: 'application/json' }))
  form.append('file', new Blob([encryptedData], { type: 'application/octet-stream' }))

  if (list.files?.length > 0) {
    const fileId = list.files[0].id
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    ).then((r) => r.json())
    return res.id
  }

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  ).then((r) => r.json())
  return res.id
}

export async function downloadFile(
  folderId: string,
  accessToken: string,
): Promise<{ data: Uint8Array; modifiedTime: string } | null> {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then((r) => r.json())

  if (!list.files?.length) return null

  const file = list.files[0]
  const buffer = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then((r) => r.arrayBuffer())

  return { data: new Uint8Array(buffer), modifiedTime: file.modifiedTime }
}

export async function getFileMetadata(
  folderId: string,
  accessToken: string,
): Promise<{ modifiedTime: string } | null> {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).then((r) => r.json())

  if (!list.files?.length) return null
  return { modifiedTime: list.files[0].modifiedTime }
}
