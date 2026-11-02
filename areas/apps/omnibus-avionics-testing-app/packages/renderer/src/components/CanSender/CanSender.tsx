import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const formSchema = z.object({
  msg_type: z.string(),
  msg_prio: z.string(),
  board_type_id: z.string(),
  board_inst_id: z.string(),
  time: z.string().refine((val) => {
    if (val.trim() === "") return true
    return !isNaN(parseInt(val, 10))
  }, {
    message: "Must be a valid integer",
  }),
})

type FormData = z.infer<typeof formSchema>

export function CanSender() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      msg_type: "",
      msg_prio: "",
      board_type_id: "",
      board_inst_id: "",
      time: "",
    },
  })

  const onSubmit = (data: FormData) => {
    // Convert values to JSON format
    const parsedData = {
      msg_type: data.msg_type.trim() || null,
      msg_prio: data.msg_prio.trim() || null,
      board_type_id: data.board_type_id.trim() || null,
      board_inst_id: data.board_inst_id.trim() || null,
      time: data.time.trim() ? parseInt(data.time, 10) : null,
    }
    console.log(parsedData)
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col items-stretch gap-3 bg-zinc-900 p-4 rounded-lg">
          {/* msg_type */}
          <FormField
            control={form.control}
            name="msg_type"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs text-zinc-400">msg_type </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    placeholder="str"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* msg_prio */}
          <FormField
            control={form.control}
            name="msg_prio"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs text-zinc-400">msg_prio </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    placeholder="str"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* board_type_id */}
          <FormField
            control={form.control}
            name="board_type_id"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs text-zinc-400">board_type_id </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    placeholder="str"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* board_inst_id */}
          <FormField
            control={form.control}
            name="board_inst_id"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs text-zinc-400">board_inst_id </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    placeholder="str"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs text-zinc-400">time (s)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    placeholder="int"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          
         


          {/* SEND Button */}
          <Button
            type="submit"
            className="bg-zinc-700 hover:bg-zinc-600 text-white h-9 px-6"
          >
            SEND
          </Button>
        </div>
      </form>
    </Form>
    </div>
  )
}
