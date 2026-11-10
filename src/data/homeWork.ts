import { workExperienceHref } from '../utils/paths';

export type HomeMediaKind = 'image' | 'video';

export interface HomeMediaItem {
  kind: HomeMediaKind;
  /** Public asset path, or YouTube video id when kind is `video`. */
  src: string;
  alt: string;
  span?: 'feature' | 'wide';
}

export interface HomeWorkPillar {
  num: string;
  slug: 'custom' | 'images' | 'animation';
  label: string;
  path: string;
  description: string;
  layout: 'mosaic-a' | 'mosaic-b' | 'mosaic-c';
  media: HomeMediaItem[];
}

/** One-line lead on the home hero — from resume professional summary. */
export const homeSummary =
  'Lead 3D Artist and Technical Artist in AR/VR and real-time production — animation, rigging, modeling, lighting, pipelines, and engineering collaboration.';

export const homeWorkPillars: HomeWorkPillar[] = [
  {
    num: '01',
    slug: 'custom',
    label: 'custom',
    path: workExperienceHref(),
    description:
      'Lead 3D art for branded AR applications and VR campaigns at Tactic Studio. Credits include Google Spotlight Stories (Pearl, On Ice), Facebook Spaces, and Monterey Bay Aquarium exhibition work.',
    layout: 'mosaic-a',
    media: [
      {
        kind: 'image',
        src: '/assets/wp-import/facebook_spaces.jpg',
        alt: 'Facebook Spaces',
        span: 'feature',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/gcn-2017.jpg',
        alt: 'Google Next opening keynote 2017',
      },
      {
        kind: 'video',
        src: 'dr_04PCSDWE',
        alt: 'Facebook Spaces preview',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/image3.jpeg',
        alt: 'Pearl — Google Spotlight Stories',
        span: 'wide',
      },
    ],
  },
  {
    num: '02',
    slug: 'images',
    label: 'images',
    path: workExperienceHref(),
    description:
      'Laser-scan and image-based modeling — Maya Skies at Chabot Space & Science Center, Trésors engloutis du Nil, Chichen Itzá reconstructions, and on-location scan pipelines at Insight Digital.',
    layout: 'mosaic-b',
    media: [
      {
        kind: 'image',
        src: '/assets/wp-import/kukulkan_pyramid.jpg',
        alt: 'Kukulkan pyramid laser-scan model',
        span: 'feature',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/chichenitza_ballcourt.jpg',
        alt: 'Chichen Itzá ball court',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/gebelsilsilah_04.jpg',
        alt: 'Gebel Silsilah point-cloud reconstruction',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/osario_top_render06.jpg',
        alt: 'Osario reconstruction previsualization',
      },
    ],
  },
  {
    num: '03',
    slug: 'animation',
    label: 'animation',
    path: workExperienceHref(),
    description:
      'Character rigging, animation, and cinematics — Unity integration at DeNA West, prototype Kinect work at Floathybrid, and game cinematics including Iron Man, Escape Plan, and Blood Brothers 2.',
    layout: 'mosaic-c',
    media: [
      {
        kind: 'video',
        src: 'G3V9Jj7SwME',
        alt: 'Iron Man cinematic',
        span: 'feature',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/squishbot_char012.png',
        alt: 'Squishbot character — prototype Kinect game',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/image2.jpeg',
        alt: 'Transformers: Age of Extinction mobile game',
      },
      {
        kind: 'image',
        src: '/assets/wp-import/ironman_cinematic.jpg',
        alt: 'Iron Man cinematic still',
      },
    ],
  },
];
