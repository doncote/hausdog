import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useConversationsForProperty,
  useConversation,
  useCreateConversation,
  useSendItemChatMessage,
  useDeleteConversation,
  MessageRole,
  type ConversationWithLastMessage,
} from '@/features/chat'

interface ItemChatProps {
  itemId: string
  itemName: string
  propertyId: string
  userId: string
}

export function ItemChat({ itemId, itemName, propertyId, userId }: ItemChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [inputMessage, setInputMessage] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [conversationToDelete, setConversationToDelete] =
    useState<ConversationWithLastMessage | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter conversations to those related to this item (by title prefix)
  const { data: allConversations, isPending: conversationsLoading } =
    useConversationsForProperty(propertyId)

  const itemConversations = allConversations?.filter((c) =>
    c.title?.startsWith(`${itemName}:`) || c.title?.includes(itemName),
  )

  const { data: activeConversation, isPending: conversationLoading } =
    useConversation(selectedConversationId || undefined)

  const createConversation = useCreateConversation()
  const sendMessage = useSendItemChatMessage()
  const deleteConversation = useDeleteConversation()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  const handleNewConversation = async () => {
    try {
      const conversation = await createConversation.mutateAsync({
        userId,
        input: { propertyId, title: `${itemName}: New chat` },
      })
      setSelectedConversationId(conversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      toast.error('Failed to create conversation')
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversationId) return

    const messageContent = inputMessage.trim()
    setInputMessage('')

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConversationId,
        propertyId,
        itemId,
        userId,
        message: messageContent,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    }
  }

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return

    try {
      await deleteConversation.mutateAsync({
        id: conversationToDelete.id,
        propertyId: conversationToDelete.propertyId,
      })
      if (selectedConversationId === conversationToDelete.id) {
        setSelectedConversationId('')
      }
      toast.success('Conversation deleted')
      setShowDeleteDialog(false)
      setConversationToDelete(null)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-xl border bg-card">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-secondary p-2.5">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <h2 className="font-semibold">Ask about this item</h2>
                  <p className="text-sm text-muted-foreground">
                    Chat with AI about {itemName}
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t p-4">
              <div className="grid gap-4 lg:grid-cols-4">
                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-3">
                  <Button
                    onClick={handleNewConversation}
                    disabled={createConversation.isPending}
                    className="w-full gap-2"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    New Chat
                  </Button>

                  {conversationsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : itemConversations && itemConversations.length > 0 ? (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {itemConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`group flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors ${
                            selectedConversationId === conv.id
                              ? 'bg-secondary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => setSelectedConversationId(conv.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {conv.title?.replace(`${itemName}: `, '') || 'New chat'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConversationToDelete(conv)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      No chats yet
                    </p>
                  )}
                </div>

                {/* Chat Area */}
                <div className="lg:col-span-3">
                  <div className="rounded-lg border bg-background flex flex-col h-[300px]">
                    {!selectedConversationId ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Start a new chat to ask about this item
                          </p>
                        </div>
                      </div>
                    ) : conversationLoading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                          {activeConversation?.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.role === MessageRole.USER
                                  ? 'justify-end'
                                  : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                  message.role === MessageRole.USER
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                {message.role === MessageRole.USER ? (
                                  <p className="text-sm whitespace-pre-wrap">
                                    {message.content}
                                  </p>
                                ) : (
                                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                                    <Markdown>{message.content}</Markdown>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t p-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ask about this item..."
                              value={inputMessage}
                              onChange={(e) => setInputMessage(e.target.value)}
                              onKeyDown={handleKeyDown}
                              disabled={sendMessage.isPending}
                              className="h-9"
                            />
                            <Button
                              onClick={handleSendMessage}
                              disabled={!inputMessage.trim() || sendMessage.isPending}
                              size="sm"
                            >
                              {sendMessage.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConversation}
              disabled={deleteConversation.isPending}
            >
              {deleteConversation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
