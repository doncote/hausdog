import type { User } from '@supabase/supabase-js'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle, PartyPopper, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardStats } from '@/features/dashboard/api'
import { getSupabaseBrowserClient } from '@/lib/supabase'

interface OnboardingChecklistProps {
  user: User
  stats: DashboardStats | undefined
}

const STEPS = [
  {
    label: 'Add your first property',
    href: '/properties/new',
    isComplete: (stats: DashboardStats) => stats.propertyCount > 0,
  },
  {
    label: 'Capture your first document',
    href: '/capture',
    isComplete: (stats: DashboardStats) => stats.documentCount > 0,
  },
  {
    label: 'Add 5 items to your home',
    href: '/capture',
    isComplete: (stats: DashboardStats) => stats.itemCount >= 5,
    progress: (stats: DashboardStats) => `${Math.min(stats.itemCount, 5)} of 5 items added`,
  },
] as const

export function OnboardingChecklist({ user, stats }: OnboardingChecklistProps) {
  const [celebrating, setCelebrating] = useState(false)
  const [hidden, setHidden] = useState(false)

  const onboardingComplete = user.user_metadata?.onboarding_complete === true
  const onboardingDismissed = user.user_metadata?.onboarding_dismissed === true

  const completedCount = stats ? STEPS.filter((step) => step.isComplete(stats)).length : 0

  const allComplete = completedCount === STEPS.length

  // Trigger celebration when all steps complete
  useEffect(() => {
    if (!allComplete || !stats || onboardingComplete) return

    setCelebrating(true)

    const supabase = getSupabaseBrowserClient()
    supabase.auth.updateUser({ data: { onboarding_complete: true } })

    const timer = setTimeout(() => {
      setHidden(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [allComplete, stats, onboardingComplete])

  if (hidden || onboardingComplete || onboardingDismissed) return null

  const handleDismiss = async () => {
    setHidden(true)
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.updateUser({ data: { onboarding_dismissed: true } })
  }

  // Find the next incomplete step for the Continue button
  const nextStep = stats ? STEPS.find((step) => !step.isComplete(stats)) : STEPS[0]

  if (celebrating) {
    return (
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardContent className="py-8 text-center">
          <PartyPopper className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">Your home is set up!</h3>
          <p className="text-sm text-muted-foreground">
            You've completed all the setup steps. Welcome to Hausdog!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Get started with Hausdog</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {completedCount}/3 steps complete
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {STEPS.map((step) => {
          const complete = stats ? step.isComplete(stats) : false
          const progressLabel = 'progress' in step && stats ? step.progress(stats) : null

          return (
            <div key={step.label} className="flex items-center gap-3">
              {complete ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${complete ? 'line-through text-muted-foreground' : ''}`}>
                  {step.label}
                </p>
                {!complete && progressLabel && (
                  <p className="text-xs text-muted-foreground">{progressLabel}</p>
                )}
              </div>
            </div>
          )
        })}

        {nextStep && (
          <div className="pt-2">
            <Link to={nextStep.href}>
              <Button size="sm">Continue Setup</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
