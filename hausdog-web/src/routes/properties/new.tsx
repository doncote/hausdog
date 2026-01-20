import { createFileRoute, useNavigate, useRouteContext } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requireAuthFromContext } from '@/lib/auth'
import { createPropertySchema } from '@hausdog/domain/properties'
import { useCreateProperty } from '@/features/properties'

export const Route = createFileRoute('/properties/new')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: NewPropertyPage,
})

function NewPropertyPage() {
  const { user } = useRouteContext({ from: '/properties/new' })
  const navigate = useNavigate()
  const createProperty = useCreateProperty()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = createPropertySchema.safeParse({ name, address: address || undefined })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    if (!user) return

    try {
      const property = await createProperty.mutateAsync({
        userId: user.id,
        input: result.data,
      })
      toast.success('Property created')
      navigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })
    } catch {
      toast.error('Failed to create property')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>New Property</CardTitle>
          <CardDescription>
            Add a new home or property to track its systems and documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Main House, Beach Cottage"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="123 Main St, City, State 12345"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
              {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/properties' })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProperty.isPending}>
                {createProperty.isPending ? 'Creating...' : 'Create Property'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
