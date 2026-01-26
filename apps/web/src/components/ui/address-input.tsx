'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete'
import { cn } from '@/lib/utils'
import type { AddressData } from '@/lib/address'
import { emptyAddressData } from '@/lib/address'

interface AddressInputProps {
  value?: string
  onChange?: (data: AddressData) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): Partial<AddressData> {
  const result: Partial<AddressData> = {}

  for (const component of components) {
    const types = component.types

    if (types.includes('street_number')) {
      result.streetAddress = component.long_name
    } else if (types.includes('route')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress} ${component.long_name}`
        : component.long_name
    } else if (types.includes('subpremise')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress}, ${component.long_name}`
        : component.long_name
    } else if (types.includes('locality')) {
      result.city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      result.state = component.short_name
    } else if (types.includes('administrative_area_level_2')) {
      result.county = component.long_name
    } else if (types.includes('postal_code')) {
      result.postalCode = component.long_name
    } else if (types.includes('country')) {
      result.country = component.short_name
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
      result.neighborhood = component.long_name
    }
  }

  return result
}

export function AddressInput({
  value,
  onChange,
  placeholder = 'Start typing an address...',
  disabled = false,
  className,
}: AddressInputProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load Google Maps API
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('VITE_GOOGLE_PLACES_API_KEY is not set')
      return
    }

    // Set API options once
    setOptions({
      key: GOOGLE_PLACES_API_KEY,
      v: 'weekly',
    })

    // Import the places library
    importLibrary('places').then(() => {
      setIsLoaded(true)
    })
  }, [])

  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      types: ['address'],
    },
    debounce: 300,
    initOnMount: isLoaded,
  })

  // Sync external value
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setValue(value, false)
    }
  }, [value, setValue, inputValue])

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (placeId: string, description: string) => {
    setValue(description, false)
    clearSuggestions()
    setShowSuggestions(false)

    if (!onChange) return

    try {
      const details = await getDetails({
        placeId,
        fields: [
          'address_components',
          'formatted_address',
          'geometry',
          'place_id',
          'plus_code',
          'utc_offset_minutes',
        ],
      })

      if (!details || typeof details === 'string') {
        onChange({ ...emptyAddressData, formattedAddress: description })
        return
      }

      const addressComponents = parseAddressComponents(
        details.address_components || []
      )

      // Calculate timezone from UTC offset
      let timezone: string | null = null
      if (details.utc_offset_minutes !== undefined) {
        const hours = Math.floor(Math.abs(details.utc_offset_minutes) / 60)
        const mins = Math.abs(details.utc_offset_minutes) % 60
        const sign = details.utc_offset_minutes >= 0 ? '+' : '-'
        timezone = `UTC${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      }

      const addressData: AddressData = {
        streetAddress: addressComponents.streetAddress ?? null,
        city: addressComponents.city ?? null,
        state: addressComponents.state ?? null,
        postalCode: addressComponents.postalCode ?? null,
        country: addressComponents.country ?? null,
        county: addressComponents.county ?? null,
        neighborhood: addressComponents.neighborhood ?? null,
        latitude: details.geometry?.location?.lat() ?? null,
        longitude: details.geometry?.location?.lng() ?? null,
        timezone,
        plusCode: details.plus_code?.global_code ?? null,
        googlePlaceId: details.place_id ?? null,
        formattedAddress: details.formatted_address ?? description,
        googlePlaceData: details as unknown as Record<string, unknown>,
      }

      onChange(addressData)
    } catch (error) {
      console.error('Error fetching place details:', error)
      onChange({ ...emptyAddressData, formattedAddress: description })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setShowSuggestions(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        disabled={disabled || !ready}
        placeholder={!isLoaded ? 'Loading...' : placeholder}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
      />

      {showSuggestions && status === 'OK' && data.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {data.map((suggestion) => (
            <li
              key={suggestion.place_id}
              onClick={() => handleSelect(suggestion.place_id, suggestion.description)}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {suggestion.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
