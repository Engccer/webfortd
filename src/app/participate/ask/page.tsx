"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { Sidebar } from "@/components/layout/Sidebar"
import { mainNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/Button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"

const askFormSchema = z.object({
  category: z.string().min(1, "분야를 선택해주세요"),
  title: z.string().min(5, "제목은 5자 이상 입력해주세요"),
  content: z.string().min(20, "내용은 20자 이상 입력해주세요"),
  email: z.string().email("올바른 이메일 형식을 입력해주세요").optional().or(z.literal("")),
  agree: z.boolean().refine((val) => val === true, "동의가 필요합니다"),
})

type AskFormValues = z.infer<typeof askFormSchema>

const participateNav = mainNavigation.find((item) => item.href === "/participate")

export default function AskPage() {
  const form = useForm<AskFormValues>({
    resolver: zodResolver(askFormSchema),
    defaultValues: {
      category: "",
      title: "",
      content: "",
      email: "",
      agree: false,
    },
  })

  function onSubmit(data: AskFormValues) {
    console.log(data)
    // TODO: 서버에 질문 등록 API 호출
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumb />

      <div className="flex gap-8">
        {participateNav?.children && (
          <aside className="hidden lg:block">
            <Sidebar items={participateNav.children} title="참여하기" />
          </aside>
        )}

        <article className="flex-1">
          <h1 className="mb-6 text-3xl font-bold text-foreground">질문하기</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            궁금한 점을 질문해 주세요. 전문가가 답변해 드립니다.
          </p>

          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-primary">질문 전 확인해 주세요</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                <li>
                  <Link href="/participate/faq" className="text-primary underline">
                    자주 묻는 질문
                  </Link>
                  에서 비슷한 질문을 먼저 찾아보세요.
                </li>
                <li>개인정보(이름, 학교명 등)는 입력하지 마세요.</li>
                <li>답변까지 영업일 기준 3~5일이 소요될 수 있습니다.</li>
              </ul>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>질문 분야</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="분야를 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="support">편의제공</SelectItem>
                        <SelectItem value="hr">인사관리</SelectItem>
                        <SelectItem value="rights">권리구제</SelectItem>
                        <SelectItem value="tech">보조공학기기</SelectItem>
                        <SelectItem value="other">기타</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input placeholder="질문 제목을 입력하세요" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>질문 내용</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="궁금한 점을 자세히 작성해 주세요"
                        rows={8}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>답변 받을 이메일 (선택)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="example@email.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      이메일을 입력하시면 답변이 등록될 때 알림을 받을 수 있습니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agree"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">
                        질문 내용이 FAQ에 익명으로 게시될 수 있음에 동의합니다.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg">
                질문 등록하기
              </Button>
            </form>
          </Form>

          <Card className="mt-12 bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">긴급 상담이 필요하신가요?</CardTitle>
              <CardDescription>
                긴급한 상담이 필요하시면 아래 기관에 직접 연락해 주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground">
                <li>국가인권위원회: 1331</li>
                <li>장애인권익옹호기관: 1644-8295 (24시간)</li>
              </ul>
            </CardContent>
          </Card>
        </article>
      </div>
    </div>
  )
}
