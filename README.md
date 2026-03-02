# Frontend Dataset Builder Dashboard

A lightweight browser-based dashboard for creating dataset records with metadata, features, labels, and tags.

## Features

- Dataset header editor (name, version, description)
- Record draft builder:
  - Meta section (`asset`, `timestamp`, custom key/value fields)
  - Dynamic feature builder with typed values (`float`, `int`, `string`, `boolean`)
  - Dynamic label builder with typed values
  - Tag input with add/remove controls
- Record validation + save flow
- Records table with delete action
- Export panel for JSON and JSONL
- **Generate Sample Dataset** button for first-time users
- **Import Dataset JSON** file button to load external data
- **Editable JSON preview** panel to inspect and apply direct JSON edits
- Draft autosave to localStorage every 2 seconds

## Run locally

```bash
python3 -m http.server 4173
```

Open: <http://127.0.0.1:4173>

## Data shape

The preview/import/export object shape:

```json
{
  "datasetInfo": {
    "name": "string",
    "version": "string",
    "description": "string"
  },
  "records": [
    {
      "id": "uuid",
      "meta": { "asset": "image", "timestamp": "ISO_DATE" },
      "features": { "featureName": 1.23 },
      "labels": { "labelName": "value" },
      "tags": ["tag-a", "tag-b"]
    }
  ],
  "draftRecord": {
    "meta": {},
    "features": {},
    "labels": {},
    "tags": []
  }
}
```
