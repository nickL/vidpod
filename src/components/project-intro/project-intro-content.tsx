import type { ReactNode } from "react"

export type ProjectIntro = {
  title: string
  subtitle: string
  mobileNotice: ReactNode
  intro: ReactNode
  technicalNotes: ReactNode[]
  signoff: string
}

export const projectIntro: ProjectIntro = {
  title: "Vidpod",
  subtitle: "Full-Stack Video Editor",
  mobileNotice: (
    <>
      Heads up: you're on mobile. The editor is built for desktop. 
      These notes cover what you need for the review.
    </>
  ),
  intro: (
    <>
      <p>
        <strong>Rox & Team,</strong>
      </p>
      <p>
        Thanks for taking a look! I really got into this one. Per the
        brief, I put together a full-stack app. A few notes on what&apos;s here:
      </p>
      <ul>
        <li>
          <strong>Ad Library:</strong> Some nostalgic ads to drop in. You can
          also upload your own.
        </li>
        <li>
          <strong>Ad Markers:</strong> Drag as needed. <i>Note:</i> I added a
          rule to prevent overlap. LMK any issues.
        </li>
        <li>
          <strong>Video Upload:</strong> Swap in a new episode video and set it as the source. 
          Hit "Reset demo" to return to the original.
        </li>
        <li>
          <strong>HLS Preview:</strong> Play or download the stitched stream.
        </li>
        <li>
          <strong><i>Transcription:</i></strong> This is up next (check back in a few). Didn't want to delay getting it over.
        </li>
      </ul>
      <p>
        <strong>
          Otherwise, everything you'd think works, works 😉
        </strong>
      </p>
    </>
  ),
  technicalNotes: [
    <>App: TypeScript + Next.js + Tailwind.</>,
    <>DB: Drizzle + Neon Postgres (fast iteration). Cloudflare D1 once I harden the data model.</>,
    <>Pipelines: Cloudflare Workers + Cloudflare Stream. hls.js for playback. Plus a small transcoding + generation API.</>,
  ],
  signoff: "– Nick",
}
