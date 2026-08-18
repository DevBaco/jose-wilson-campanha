---
version: alpha
name: "Wilson Campos – Campanha Política 2026"
description: "Design system para o site de campanha de Wilson Campos, pré-candidato a Deputado Estadual de Minas Gerais. A identidade visual é construída sobre uma paleta azul institucional, branco/off-white e amarelo como cor de destaque. A linguagem visual combina tipografia Inter de alto impacto, Rubik para leitura, grandes blocos de cor, geometria diagonal e composição editorial forte. O sistema foi preparado para implementação em Astro com Tailwind CSS."

brand:
  candidate: "Wilson Campos"
  campaign: "Wilson Campos 2026"
  office: "Deputado Estadual – Minas Gerais"
  city: "Itabira – Minas Gerais"
  concept: "Desenvolvimento para Minas Gerais. Gratidão por Itabira."
  primaryColor: "azul"
  visualTone:
    - "institucional"
    - "moderno"
    - "forte"
    - "popular"
    - "confiável"
    - "mineiro"
    - "desenvolvimento"

colors:
  azul:
    value: "#0057B8"
    role: "Primary brand color — hero, navigation, CTA, links, campaign blocks"

  azul-escuro:
    value: "#073B73"
    role: "Dark brand surface, hover state, footer, high-contrast sections"

  azul-profundo:
    value: "#06284D"
    role: "Maximum contrast surfaces and dark campaign sections"

  azul-claro:
    value: "#DCEEFF"
    role: "Soft backgrounds, cards, information panels"

  amarelo:
    value: "#F5C400"
    role: "Highlight accent, campaign details, emphasis and decorative elements"

  amarelo-claro:
    value: "#FFF3B8"
    role: "Soft highlight surface"

  branco:
    value: "#FFFFFF"
    role: "Cards, navigation, text on dark backgrounds"

  off-white:
    value: "#F7F5EF"
    role: "Main page background and warm editorial surface"

  preto:
    value: "#17202A"
    role: "Primary text and headings on light backgrounds"

  cinza-texto:
    value: "#4A5560"
    role: "Secondary text, metadata and supporting copy"

  cinza:
    value: "#C8CDD2"
    role: "Borders, dividers and subtle separators"

  cinza-claro:
    value: "#E8EBEE"
    role: "Soft borders and secondary surfaces"

typography:
  display-hero:
    fontFamily: "Inter, sans-serif"
    fontSize: "40.96px"
    fontWeight: "900"
    lineHeight: "47.104px"
    letterSpacing: "-1.024px"

  display-large:
    fontFamily: "Inter, sans-serif"
    fontSize: "35.84px"
    fontWeight: "900"
    lineHeight: "41.216px"
    letterSpacing: "-0.7168px"

  display-medium:
    fontFamily: "Inter, sans-serif"
    fontSize: "28px"
    fontWeight: "900"
    lineHeight: "33.6px"
    letterSpacing: "-0.56px"

  nav-label:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: "700"
    lineHeight: "normal"
    letterSpacing: "0.91px"

  cta-button:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: "700"
    lineHeight: "22.4px"
    letterSpacing: "1.4px"

  badge-tag:
    fontFamily: "Inter, sans-serif"
    fontSize: "12.48px"
    fontWeight: "700"
    lineHeight: "19.968px"
    letterSpacing: "0.9984px"

  body-default:
    fontFamily: "Rubik, sans-serif"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "25.6px"

  body-large:
    fontFamily: "Rubik, sans-serif"
    fontSize: "18px"
    fontWeight: "400"
    lineHeight: "28.8px"

  body-small:
    fontFamily: "Rubik, sans-serif"
    fontSize: "12.48px"
    fontWeight: "400"
    lineHeight: "17.472px"

  subheading:
    fontFamily: "Inter, sans-serif"
    fontSize: "16.8px"
    fontWeight: "700"
    lineHeight: "20.16px"

spacing:
  s1: "4px"
  s2: "8px"
  s3: "16px"
  s4: "24px"
  s5: "32px"
  s6: "48px"
  s7: "64px"
  s8: "96px"
  s9: "128px"

rounded:
  r-sm: "4px"
  r-md: "8px"
  r-lg: "12px"
  r-xl: "16px"
  r-2xl: "24px"
  r-full: "9999px"

layout:
  maxWidth: "1200px"
  mobile: "767px"
  tablet: "1023px"
  desktop: "1024px"

geometry:
  heroStyle: "diagonal"
  imageTreatment: "high-contrast blue/yellow overlay"
  decorativeShape: "diagonal bands"
  cardStyle: "soft rounded"
  visualDensity: "high"
  shadows: "minimal"

components:
  button:
    primary: "azul"
    secondary: "amarelo"
    dark: "azul-escuro"

  badge:
    default: "azul"
    highlight: "amarelo"

  card:
    background: "branco"
    border: "cinza-claro"
    radius: "r-xl"

  section:
    default: "off-white"
    alternate: "branco"
    dark: "azul-profundo"

responsive:
  mobile:
    maxWidth: "767px"
    behavior:
      - "single column"
      - "stacked hero"
      - "compact navigation"
      - "reduced section spacing"

  tablet:
    minWidth: "768px"
    maxWidth: "1023px"
    behavior:
      - "two-column layouts where appropriate"
      - "medium spacing"

  desktop:
    minWidth: "1024px"
    behavior:
      - "full editorial composition"
      - "diagonal hero geometry"
      - "multi-column sections"

accessibility:
  normalTextContrast: "4.5:1 minimum"
  largeTextContrast: "3:1 minimum"
  focusOutline: "#0057B8"
  focusWidth: "3px"
  focusOffset: "2px"
---