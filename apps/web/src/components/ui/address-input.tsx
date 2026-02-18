import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useRef, useState } from 'react'
import type { AddressData } from '@/lib/address'
import { emptyAddressData } from '@/lib/address'
const getGooglePlacesApiKey = () =>
  typeof window !== 'undefined' ? window.ENV?.GOOGLE_PLACES_API_KEY : undefined
import { cn } from '@/lib/utils'

interface AddressInputProps {
  value?: string
  onChange?: (data: AddressData) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface Suggestion {
  placeId: string
  text: string
  mainText: string
  secondaryText: string
}

function parseAddressComponents(
  components: google.maps.places.AddressComponent[],
): Partial<AddressData> {
  const result: Partial<AddressData> = {}

  for (const component of components) {
    const types = component.types

    if (types.includes('street_number')) {
      result.streetAddress = component.longText
    } else if (types.includes('route')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress} ${component.longText}`
        : component.longText
    } else if (types.includes('subpremise')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress}, ${component.longText}`
        : component.longText
    } else if (types.includes('locality')) {
      result.city = component.longText
    } else if (types.includes('administrative_area_level_1')) {
      result.state = component.shortText
    } else if (types.includes('administrative_area_level_2')) {
      result.county = component.longText
    } else if (types.includes('country')) {
      result.country = component.shortText
    } else if (types.includes('postal_code')) {
      result.postalCode = component.longText
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
      result.neighborhood = component.longText
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
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
    const apiKey = getGooglePlacesApiKey()
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY is not set in window.ENV')
      return
    }

    setOptions({
      key: apiKey,
      v: 'weekly',
    })

    importLibrary('places').then(() => {
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

  const fetchSuggestions = async (input: string) => {
    if (!isLoaded || !input.trim()) {
      setSuggestions([])
      return
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        // Use the new Places API (AutocompleteSuggestion)
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            includedPrimaryTypes: ['street_address', 'subpremise', 'premise'],
          })

        const mapped: Suggestion[] = results
          .filter((s) => s.placePrediction)
          .map((s) => ({
            placeId: s.placePrediction!.placeId,
            text: s.placePrediction!.text.text,
            mainText: s.placePrediction!.mainText?.text || s.placePrediction!.text.text,
            secondaryText: s.placePrediction!.secondaryText?.text || '',
          }))

        setSuggestions(mapped)
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      }
    }, 300)
  }

  const handleSelect = async (placeId: string, description: string) => {
    setInputValue(description)
    setSuggestions([])
    setShowSuggestions(false)

    if (!onChange) return

    try {
      // Use the new Places API (Place class)
      const place = new google.maps.places.Place({ id: placeId })
      await place.fetchFields({
        fields: [
          'addressComponents',
          'formattedAddress',
          'location',
          'id',
          'plusCode',
          'utcOffsetMinutes',
        ],
      })

      const addressComponents = parseAddressComponents(place.addressComponents || [])

      let timezone: string | null = null
      if (place.utcOffsetMinutes !== undefined && place.utcOffsetMinutes !== null) {
        const hours = Math.floor(Math.abs(place.utcOffsetMinutes) / 60)
        const mins = Math.abs(place.utcOffsetMinutes) % 60
        const sign = place.utcOffsetMinutes >= 0 ? '+' : '-'
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
        latitude: place.location?.lat() ?? null,
        longitude: place.location?.lng() ?? null,
        timezone,
        plusCode: place.plusCode?.globalCode ?? null,
        googlePlaceId: place.id ?? null,
        formattedAddress: place.formattedAddress ?? description,
        googlePlaceData: place.toJSON() as unknown as Record<string, unknown>,
      }

      onChange(addressData)
    } catch (error) {
      console.error('Error fetching place details:', error)
      onChange({ ...emptyAddressData, formattedAddress: description })
    }
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
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.placeId}
              role="option"
              tabIndex={0}
              onClick={() => handleSelect(suggestion.placeId, suggestion.text)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect(suggestion.placeId, suggestion.text)
                }
              }}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            >
              <span className="font-medium">{suggestion.mainText}</span>
              {suggestion.secondaryText && (
                <span className="text-muted-foreground"> {suggestion.secondaryText}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
