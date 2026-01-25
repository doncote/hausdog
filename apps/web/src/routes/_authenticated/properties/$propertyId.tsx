import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/properties/$propertyId')({
  component: PropertyLayout,
})

function PropertyLayout() {
  return <Outlet />
}
