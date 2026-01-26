import { z } from 'zod'

export const addressDataSchema = z.object({
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  county: z.string().nullable(),
  neighborhood: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  plusCode: z.string().nullable(),
  googlePlaceId: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  googlePlaceData: z.record(z.unknown()).nullable(),
})

export type AddressData = z.infer<typeof addressDataSchema>

export const emptyAddressData: AddressData = {
  streetAddress: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  county: null,
  neighborhood: null,
  latitude: null,
  longitude: null,
  timezone: null,
  plusCode: null,
  googlePlaceId: null,
  formattedAddress: null,
  googlePlaceData: null,
}
