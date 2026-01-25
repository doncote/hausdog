# Property Lookup Feature Design

Auto-populate property details using Gemini with Google Search grounding.

## Overview

When users create a property or click "Lookup Property Info", we query Gemini with search grounding to find publicly available property data (year built, square footage, etc.) and populate the property record.

## User Flow

### Property Creation (auto-apply)
1. User enters property name and address
2. On submit, if address provided, trigger lookup in background
3. Auto-populate empty fields with lookup results
4. Store raw response in `lookupData` JSON field
5. If lookup fails, show toast "Couldn't find property data for this address"

### On-Demand Refresh (preview first)
1. User clicks "Lookup Property Info" button in property settings
2. Trigger lookup, show loading state
3. Display modal with found data vs current values
4. User clicks "Apply" to update or "Cancel" to dismiss
5. If lookup fails, show toast with failure message

## Database Changes

Add to `Property` model in `prisma/schema.prisma`:
```prisma
lookupData Json?
```

## New Files

### `src/lib/llm/property-lookup.ts`
Gemini search grounding logic:
- Calls Gemini 2.5 Flash with `googleSearch` tool
- Prompts for structured property data
- Parses and validates response

### `src/features/properties/lookup.ts`
Server function exposing lookup to client:
- `lookupPropertyData({ address })` - returns structured data + raw

## Gemini Integration

### Request
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  tools: [{ googleSearch: {} }],
})

const prompt = `Find property details for: ${address}

Return JSON only:
{
  "found": true/false,
  "address": "normalized address",
  "yearBuilt": number | null,
  "squareFeet": number | null,
  "lotSquareFeet": number | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "propertyType": "single_family|condo|townhouse|multi_family|other",
  "stories": number | null,
  "source": "where the data came from"
}`
```

### Response Handling
- Parse JSON from response text
- Extract `groundingMetadata` for source URLs
- Return structured `PropertyLookupResult` type

## Integration Points

### Property Creation
Modify `createProperty` API or form submission:
```typescript
if (input.address) {
  const lookup = await lookupPropertyData({ address: input.address })
  if (lookup.found) {
    input.yearBuilt ??= lookup.yearBuilt
    input.squareFeet ??= lookup.squareFeet
    input.propertyType ??= lookup.propertyType
    input.lookupData = lookup.raw
  }
}
```

### Property Settings
Add "Lookup Property Info" button that:
1. Calls `lookupPropertyData`
2. Opens preview modal with comparison
3. On confirm, calls `updateProperty` with new values

## Google Branding Requirement

When using Search grounding, must display "Search Suggestions" link.
- Include in preview modal footer
- Show subtle note after auto-apply on creation

## Error Handling

- Network/API errors: Log, show generic failure toast
- No results found: `found: false`, show "Couldn't find property data" toast
- Invalid JSON response: Treat as no results

## Cost

- Gemini 2.5 Flash with search: ~$0.0001 per lookup
- Billed per prompt

## Implementation Tasks

1. Add `lookupData` column to Property schema
2. Create `src/lib/llm/property-lookup.ts` with Gemini integration
3. Create `src/features/properties/lookup.ts` server function
4. Update property creation flow to call lookup
5. Add "Lookup Property Info" button and preview modal
6. Add toast notifications for success/failure feedback
