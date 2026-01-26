import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useRef, useState } from 'react'
import type { AddressData } from '@/lib/address'
import { emptyAddressData } from '@/lib/address'
import { cn } from '@/lib/utils'

interface AddressInputProps {
  value?: string
  onChange?: (data: AddressData) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[],
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
    } else if (types.includes('country')) {
      result.country = component.short_name
    } else if (types.includes('postal_code')) {
      result.postalCode = component.long_name
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
      result.neighborhood = component.long_name
    }
  }

  return result
}

const inputClassName =
  'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'

export function AddressInput({
  value,
  onChange,
  placeholder = 'Start typing an address...',
  disabled = false,
  className,
}: AddressInputProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mark as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Sync external value
  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  // Load Google Maps API
  useEffect(() => {
    if (!isMounted) return
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('VITE_GOOGLE_PLACES_API_KEY is not set')
      return
    }

    setOptions({
      key: GOOGLE_PLACES_API_KEY,
      v: 'weekly',
    })

    importLibrary('places').then(() => {
      autocompleteService.current = new google.maps.places.AutocompleteService()
      // Create a dummy div for PlacesService (it requires an element)
      const dummyDiv = document.createElement('div')
      placesService.current = new google.maps.places.PlacesService(dummyDiv)
      setIsLoaded(true)
    })
  }, [isMounted])

  // Close suggestions on click outside
  useEffect(() => {
    if (!isMounted) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMounted])

  const fetchSuggestions = (input: string) => {
    if (!autocompleteService.current || !input.trim()) {
      setSuggestions([])
      return
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      autocompleteService.current?.getPlacePredictions(
        { input, types: ['address'] },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions)
          } else {
            setSuggestions([])
          }
        },
      )
    }, 300)
  }

  const handleSelect = async (placeId: string, description: string) => {
    setInputValue(description)
    setSuggestions([])
    setShowSuggestions(false)

    if (!onChange || !placesService.current) return

    placesService.current.getDetails(
      {
        placeId,
        fields: [
          'address_components',
          'formatted_address',
          'geometry',
          'place_id',
          'plus_code',
          'utc_offset_minutes',
        ],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          onChange({ ...emptyAddressData, formattedAddress: description })
          return
        }

        const addressComponents = parseAddressComponents(place.address_components || [])

        let timezone: string | null = null
        if (place.utc_offset_minutes !== undefined) {
          const hours = Math.floor(Math.abs(place.utc_offset_minutes) / 60)
          const mins = Math.abs(place.utc_offset_minutes) % 60
          const sign = place.utc_offset_minutes >= 0 ? '+' : '-'
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
          latitude: place.geometry?.location?.lat() ?? null,
          longitude: place.geometry?.location?.lng() ?? null,
          timezone,
          plusCode: place.plus_code?.global_code ?? null,
          googlePlaceId: place.place_id ?? null,
          formattedAddress: place.formatted_address ?? description,
          googlePlaceData: place as unknown as Record<string, unknown>,
        }

        onChange(addressData)
      },
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    fetchSuggestions(newValue)
  }

  // SSR placeholder - must be controlled (have value) to avoid React warning on hydration
  if (!isMounted) {
    return (
      <div className="relative">
        <input
          type="text"
          value=""
          disabled
          readOnly
          placeholder="Loading..."
          className={cn(inputClassName, className)}
        />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        disabled={disabled || !isLoaded}
        placeholder={!isLoaded ? 'Loading...' : placeholder}
        className={cn(inputClassName, className)}
      />

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.place_id}
              role="option"
              tabIndex={0}
              onClick={() => handleSelect(suggestion.place_id, suggestion.description)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect(suggestion.place_id, suggestion.description)
                }
              }}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            >
              {suggestion.description}
            </div>
          ))}
        </ul>
      )}
    </div>
  )
}
