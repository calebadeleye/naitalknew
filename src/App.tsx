/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Code2, 
  Cpu, 
  Lightbulb, 
  ShieldCheck, 
  TrendingUp, 
  Globe, 
  Terminal, 
  Smartphone, 
  Brain, 
  CreditCard, 
  Lock, 
  ArrowLeft, 
  ArrowRight, 
  Quote, 
  Mail, 
  MapPin, 
  MessageSquare, 
  Share2, 
  Rss,
  Linkedin,
  Facebook,
  Twitter,
  ChevronDown,
  ArrowUp,
  Filter,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2
} from "lucide-react";

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-[60] p-4 bg-primary text-on-primary rounded-full shadow-2xl shadow-primary/20 hover:scale-110 transition-transform active:scale-95"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

const translations: any = {
  EN: {
    about: "About",
    services: "Services",
    portfolio: "Portfolio",
    estimator: "Estimator",
    insights: "Insights",
    testimonials: "Testimonials",
    contact: "Contact",
    heroTitle: "Solving complex problems through high-performance software.",
    heroDesc: "We are a technology-first company dedicated to engineering elegant solutions for your most ambitious business challenges. Scalability, reliability, and precision at the core.",
    bookAudit: "Schedule a Consultation",
    viewEcosystem: "View Ecosystem",
    coreCapabilities: "Core Capabilities",
    serviceEcosystem: "Service Ecosystem",
    caseStudies: "Case Studies",
    thePortfolio: "The Portfolio",
    philosophy: "Our Philosophy",
    aboutTitle: "Intelligent Digital Products Built for Impact.",
    aboutDesc: "NAITALK isn't just a development firm; we are architects of digital resilience. We synthesize complex requirements into elegant, high-performance solutions that scale effortlessly across global markets.",
    webHosting: "Web Hosting",
    webHostingDesc: "High-performance, secure, and scalable hosting solutions optimized for modern web applications.",
    requestAudit: "Request Audit",
    aiInsights: "AI-Powered Insights",
    projectEstimator: "Project Estimator",
    estimatorDesc: "Leverage our proprietary AI integration to architect your next mission. Get an instant technical roadmap and strategic alignment.",
    industry: "Industry",
    selectIndustry: "Select Industry",
    primaryGoal: "Primary Goal",
    selectGoal: "Select Goal",
    additionalContext: "Additional Context",
    describeRequirements: "Describe your specific requirements...",
    generateRoadmap: "Generate Roadmap",
    architecting: "Architecting...",
    awaitingParameters: "Awaiting Parameters",
    fillDetails: "Fill in your project details to generate a custom AI roadmap.",
    analyzingEcosystem: "Analyzing Ecosystem",
    synthesizing: "Synthesizing technical requirements...",
    technicalBlueprint: "Technical Blueprint",
    theRoadmap: "The Roadmap",
    keyDeliverables: "Key Deliverables",
    expertInsight: "Expert Insight",
    strategicAdvice: "Strategic Advice",
    intelligenceFeed: "Intelligence Feed",
    feedDesc: "Real-time updates from the frontier of digital engineering and AI research.",
    readMore: "Read More",
    clientVoices: "Client Voices",
    testimonialsTitle: "Trusted by Global Innovators",
    getInTouch: "Get in Touch",
    contactTitle: "Start Your Digital Evolution",
    contactDesc: "Ready to architect the future? Connect with our elite engineering team to discuss your mission-critical objectives.",
    fullName: "Full Name",
    emailAddress: "Email Address",
    selectService: "Select Service",
    projectDetails: "Project Details",
    submitProtocol: "Submit",
    sending: "Sending...",
    messageSent: "Message Sent Successfully",
    messageError: "Failed to send message. Please try again later.",
    footerDesc: "Architecting elite digital ecosystems for the global frontier.",
    allRightsReserved: "All rights reserved.",
    share: "Share Project",
    linkCopied: "Link Copied to Clipboard!",
    continue: "Continue",
    slotReserved: "Slot Reserved",
    slotReservedDesc: "We've sent a calendar invitation to your email.",
    close: "Close",
    selectDate: "Select Date",
    availableSlots: "Available Slots (EST)"
  },
  DE: {
    about: "Über uns",
    services: "Leistungen",
    portfolio: "Portfolio",
    estimator: "Schätzer",
    insights: "Einblicke",
    testimonials: "Referenzen",
    contact: "Kontakt",
    heroTitle: "Komplexe Probleme durch Hochleistungssoftware lösen.",
    heroDesc: "Wir sind ein technologieorientiertes Unternehmen, das sich der Entwicklung eleganter Lösungen für Ihre ambitioniertesten geschäftlichen Herausforderungen widmet. Skalierbarkeit, Zuverlässigkeit und Präzision im Kern.",
    bookAudit: "Beratung vereinbaren",
    viewEcosystem: "Ökosystem anzeigen",
    coreCapabilities: "Kernkompetenzen",
    serviceEcosystem: "Service-Ökosystem",
    caseStudies: "Fallstudien",
    thePortfolio: "Das Portfolio",
    philosophy: "Unsere Philosophie",
    aboutTitle: "Intelligente digitale Produkte für maximale Wirkung.",
    aboutDesc: "NAITALK ist nicht nur eine Entwicklungsfirma; wir sind Architekten digitaler Resilienz. Wir synthetisieren komplexe Anforderungen in elegante Lösungen.",
    webHosting: "Webhosting",
    webHostingDesc: "Leistungsstarke, sichere und skalierbare Hosting-Lösungen, optimiert für moderne Webanwendungen.",
    requestAudit: "Audit anfordern",
    aiInsights: "KI-gestützte Einblicke",
    projectEstimator: "Projekt-Schätzer",
    estimatorDesc: "Nutzen Sie unsere KI-Integration, um Ihre nächste Mission zu planen. Erhalten Sie eine sofortige Roadmap.",
    industry: "Branche",
    selectIndustry: "Branche auswählen",
    primaryGoal: "Primäres Ziel",
    selectGoal: "Ziel auswählen",
    additionalContext: "Zusätzlicher Kontext",
    describeRequirements: "Beschreiben Sie Ihre Anforderungen...",
    generateRoadmap: "Roadmap erstellen",
    architecting: "Architektur wird erstellt...",
    awaitingParameters: "Warten auf Parameter",
    fillDetails: "Füllen Sie Ihre Projektdaten aus, um eine Roadmap zu erstellen.",
    analyzingEcosystem: "Ökosystem-Analyse",
    synthesizing: "Technische Anforderungen werden synthetisiert...",
    technicalBlueprint: "Technischer Entwurf",
    theRoadmap: "Die Roadmap",
    keyDeliverables: "Wichtige Ergebnisse",
    expertInsight: "Experten-Einblick",
    strategicAdvice: "Strategische Beratung",
    intelligenceFeed: "Intelligenz-Feed",
    feedDesc: "Echtzeit-Updates aus der Welt des digitalen Engineerings und der KI-Forschung.",
    readMore: "Weiterlesen",
    clientVoices: "Kundenstimmen",
    testimonialsTitle: "Vertrauen von globalen Innovatoren",
    getInTouch: "Kontakt aufnehmen",
    contactTitle: "Starten Sie Ihre digitale Evolution",
    contactDesc: "Bereit für die Zukunft? Kontaktieren Sie unser Engineering-Team.",
    fullName: "Vollständiger Name",
    emailAddress: "E-Mail-Adresse",
    selectService: "Service wählen",
    projectDetails: "Projektdetails",
    submitProtocol: "Senden",
    sending: "Wird gesendet...",
    messageSent: "Nachricht erfolgreich gesendet",
    messageError: "Fehler beim Senden. Bitte versuchen Sie es später erneut.",
    footerDesc: "Gestaltung erstklassiger digitaler Ökosysteme für die globale Zukunft.",
    allRightsReserved: "Alle Rechte vorbehalten.",
    continue: "Weiter",
    slotReserved: "Termin reserviert",
    slotReservedDesc: "Wir haben eine Kalendereinladung an Ihre E-Mail gesendet.",
    close: "Schließen",
    selectDate: "Datum auswählen",
    availableSlots: "Verfügbare Termine (EST)"
  },
  ZH: {
    about: "关于",
    services: "服务",
    portfolio: "作品集",
    estimator: "评估器",
    insights: "洞察",
    testimonials: "评价",
    contact: "联系",
    heroTitle: "通过高性能软件解决复杂问题。",
    heroDesc: "我们是一家技术优先的公司，致力于为您最宏大的商业挑战提供优雅的解决方案。核心是可扩展性、可靠性和精准度。",
    bookAudit: "预约咨询",
    viewEcosystem: "查看生态系统",
    coreCapabilities: "核心能力",
    serviceEcosystem: "服务生态系统",
    caseStudies: "案例研究",
    thePortfolio: "作品集",
    philosophy: "我们的哲学",
    aboutTitle: "为影响力而构建的智能数字产品。",
    aboutDesc: "NAITALK 不仅仅是一家开发公司；我们是数字韧性的建筑师。我们将复杂的需求合成为优雅、高性能的解决方案。",
    webHosting: "网络托管",
    webHostingDesc: "为现代网络应用优化的高性能、安全且可扩展的托管解决方案。",
    requestAudit: "请求审计",
    aiInsights: "AI 驱动的洞察",
    projectEstimator: "项目评估器",
    estimatorDesc: "利用我们的 AI 集成来规划您的下一个任务。获取即时技术路线图。",
    industry: "行业",
    selectIndustry: "选择行业",
    primaryGoal: "主要目标",
    selectGoal: "选择目标",
    additionalContext: "额外背景",
    describeRequirements: "描述您的具体要求...",
    generateRoadmap: "生成路线图",
    architecting: "架构中...",
    awaitingParameters: "等待参数",
    fillDetails: "填写项目详情以生成自定义 AI 路线图。",
    analyzingEcosystem: "分析生态系统",
    synthesizing: "合成技术要求...",
    technicalBlueprint: "技术蓝图",
    theRoadmap: "路线图",
    keyDeliverables: "关键交付成果",
    expertInsight: "专家见解",
    strategicAdvice: "战略建议",
    intelligenceFeed: "情报馈送",
    feedDesc: "来自数字工程和 AI 研究前沿的实时更新。",
    readMore: "阅读更多",
    clientVoices: "客户声音",
    testimonialsTitle: "深受全球创新者信赖",
    getInTouch: "取得联系",
    contactTitle: "开始您的数字演进",
    contactDesc: "准备好构建未来了吗？联系我们的精英工程团队。",
    fullName: "全名",
    emailAddress: "电子邮件地址",
    selectService: "选择服务",
    projectDetails: "项目详情",
    submitProtocol: "提交",
    sending: "发送中...",
    messageSent: "消息发送成功",
    messageError: "发送失败。请稍后再试。",
    footerDesc: "为全球前沿构建精英数字生态系统。",
    allRightsReserved: "版权所有。",
    continue: "继续",
    slotReserved: "时段已预订",
    slotReservedDesc: "我们已向您的电子邮件发送了日历邀请。",
    close: "关闭",
    selectDate: "选择日期",
    availableSlots: "可用时段 (EST)"
  },
  FR: {
    about: "À propos",
    services: "Services",
    portfolio: "Portfolio",
    estimator: "Estimateur",
    insights: "Aperçus",
    testimonials: "Témoignages",
    contact: "Contact",
    heroTitle: "Résoudre les problèmes complexes grâce à des logiciels haute performance.",
    heroDesc: "Nous sommes une entreprise axée sur la technologie dédiée à l'ingénierie de solutions élégantes pour vos défis commerciaux les plus ambitieux. Scalabilité, fiabilité et précision au cœur.",
    bookAudit: "Planifier une consultation",
    viewEcosystem: "Voir l'Écosystème",
    coreCapabilities: "Capacités de Base",
    serviceEcosystem: "Écosystème de Services",
    caseStudies: "Études de Cas",
    thePortfolio: "Le Portfolio",
    philosophy: "Notre Philosophie",
    aboutTitle: "Produits Numériques Intelligents pour un Impact Réel.",
    aboutDesc: "NAITALK n'est pas seulement une entreprise de développement ; nous sommes des architectes de la résilience numérique.",
    webHosting: "Hébergement Web",
    webHostingDesc: "Solutions d'hébergement performantes, sécurisées et évolutives optimisées pour les applications web modernes.",
    requestAudit: "Demander un Audit",
    aiInsights: "Aperçus Propulsés par l'IA",
    projectEstimator: "Estimateur de Projet",
    estimatorDesc: "Exploitez notre intégration IA propriétaire pour concevoir votre prochaine mission. Obtenez une feuille de route instantanée.",
    industry: "Secteur",
    selectIndustry: "Choisir un Secteur",
    primaryGoal: "Objectif Principal",
    selectGoal: "Choisir un Objectif",
    additionalContext: "Contexte Additionnel",
    describeRequirements: "Décrivez vos besoins spécifiques...",
    generateRoadmap: "Générer la Feuille de Route",
    architecting: "Conception en cours...",
    awaitingParameters: "En attente de paramètres",
    fillDetails: "Remplissez les détails de votre projet pour générer une feuille de route IA personnalisée.",
    analyzingEcosystem: "Analyse de l'Écosystème",
    synthesizing: "Synthèse des exigences techniques...",
    technicalBlueprint: "Plan Technique",
    theRoadmap: "La Feuille de Route",
    keyDeliverables: "Livrables Clés",
    expertInsight: "Aperçu d'Expert",
    strategicAdvice: "Conseil Stratégique",
    intelligenceFeed: "Flux d'Intelligence",
    feedDesc: "Mises à jour en temps réel depuis la frontière de l'ingénierie numérique et de la recherche en IA.",
    readMore: "Lire la suite",
    clientVoices: "Voix des Clients",
    testimonialsTitle: "Approuvé par les Innovateurs Mondiaux",
    getInTouch: "Contactez-nous",
    contactTitle: "Commencez votre Évolution Numérique",
    contactDesc: "Prêt à concevoir l'avenir ? Contactez notre équipe d'ingénierie d'élite.",
    fullName: "Nom Complet",
    emailAddress: "Adresse E-mail",
    selectService: "Choisir un Service",
    projectDetails: "Détails du Projet",
    submitProtocol: "Soumettre",
    sending: "Envoi en cours...",
    messageSent: "Message envoyé avec succès",
    messageError: "Échec de l'envoi. Veuillez réessayer plus tard.",
    footerDesc: "Conception d'écosystèmes numériques d'élite pour la frontière mondiale.",
    allRightsReserved: "Tous droits réservés.",
    continue: "Continuer",
    slotReserved: "Créneau réservé",
    slotReservedDesc: "Nous avons envoyé une invitation calendrier à votre adresse e-mail.",
    close: "Fermer",
    selectDate: "Choisir une date",
    availableSlots: "Créneaux disponibles (EST)"
  }
};

const Logo = ({ className, size = "md" }: { className?: string, size?: "sm" | "md" | "lg" | "massive" }) => {
  const heights = {
    sm: "h-6",
    md: "h-8 md:h-10",
    lg: "h-12 md:h-20",
    massive: "h-[25vw] sm:h-[18vw] md:h-[15vw] lg:h-[12vw]"
  };

  return (
    <div className={`flex items-center whitespace-nowrap ${className}`}>
      <img 
        src="/logo.png" 
        alt="NAITALK"
        className={`${heights[size]} w-auto object-contain transition-all duration-300`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Fallback if logo is missing
          e.currentTarget.style.display = 'none';
          const span = e.currentTarget.parentElement?.querySelector('.logo-fallback');
          if (span) span.classList.remove('hidden');
        }}
      />
      <span className="logo-fallback hidden font-display font-bold text-2xl uppercase tracking-tighter bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        NAITALK
      </span>
    </div>
  );
};

const Navbar = ({ lang, setLang }: { lang: string, setLang: (l: string) => void }) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-xl shadow-2xl shadow-black/50">
      <div className="flex justify-between items-center px-6 md:px-12 py-6 max-w-[1920px] mx-auto">
        <a href="#" className="flex items-center gap-4">
          <Logo />
        </a>
        
        <div className="hidden md:flex gap-10 items-center">
          {["about", "services", "portfolio", "estimator", "insights", "testimonials"].map((key) => (
            <a 
              key={key}
              className="font-manrope tracking-tight font-bold uppercase text-[12px] text-[#e5e2e1] hover:text-[#90da49] transition-all duration-300" 
              href={`#${key}`}
            >
              {translations[lang][key]}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative">
            <button 
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg text-[10px] font-bold text-on-surface-variant hover:text-white transition-all border border-white/5"
            >
              <Globe className="w-3 h-3" />
              {lang}
              <ChevronDown className={`w-3 h-3 transition-transform ${isLangOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {isLangOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-24 glass-panel rounded-xl overflow-hidden border-white/10"
                >
                  {["EN", "DE", "ZH", "FR"].map(l => (
                    <button 
                      key={l}
                      onClick={() => { setLang(l); setIsLangOpen(false); }}
                      className={`w-full px-4 py-3 text-[10px] font-bold text-left hover:bg-white/5 transition-all ${lang === l ? "text-primary" : "text-on-surface-variant"}`}
                    >
                      {l}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <a href="#contact" className="hidden sm:block bg-primary-container text-on-primary font-manrope tracking-tight font-bold uppercase text-[12px] px-8 py-3 rounded-lg hover:bg-white/10 transition-all duration-300 scale-95 active:scale-90">
            {translations[lang].contact}
          </a>
          
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-on-surface-variant hover:text-primary transition-colors"
          >
            <div className="space-y-1.5">
              <div className={`w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}></div>
              <div className={`w-6 h-0.5 bg-current transition-opacity ${isMobileMenuOpen ? "opacity-0" : ""}`}></div>
              <div className={`w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}></div>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-panel border-t border-white/5 overflow-hidden"
          >
            <div className="flex flex-col p-6 space-y-4">
              {["about", "services", "portfolio", "estimator", "insights", "testimonials"].map((key) => (
                <a 
                  key={key}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-manrope tracking-tight font-bold uppercase text-[14px] text-[#e5e2e1] hover:text-[#90da49] transition-all" 
                  href={`#${key}`}
                >
                  {translations[lang][key]}
                </a>
              ))}
              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center bg-primary-container text-on-primary font-manrope tracking-tight font-bold uppercase text-[14px] px-8 py-4 rounded-lg hover:bg-white/10 transition-all">
                {translations[lang].contact}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const BookingModal = ({ isOpen, onClose, lang }: { isOpen: boolean, onClose: () => void, lang: string }) => {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const times = ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-panel w-full max-w-md rounded-[2.5rem] border-primary/20 p-10 relative"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-on-surface-variant hover:text-primary transition-colors"
            >
              <ChevronDown className="w-6 h-6 rotate-180" />
            </button>

            <div className="space-y-8">
              <div className="text-center space-y-2">
                <div className="text-primary font-bold uppercase tracking-widest text-[10px]">Discovery Call</div>
                <h3 className="text-3xl font-black tracking-tighter text-on-surface">{translations[lang].bookAudit}</h3>
              </div>

              {step === 1 ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{translations[lang].selectDate}</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-surface-container-low border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface py-4"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{translations[lang].availableSlots}</label>
                    <div className="grid grid-cols-2 gap-3">
                      {times.map(t => (
                        <button 
                          key={t}
                          onClick={() => setTime(t)}
                          className={`py-3 rounded-xl text-xs font-bold transition-all ${
                            time === t ? "bg-primary text-on-primary" : "glass-panel text-on-surface-variant hover:bg-white/5"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button 
                    disabled={!date || !time}
                    onClick={() => setStep(2)}
                    className="w-full bg-primary text-on-primary py-5 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {translations[lang].continue}
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-on-surface">{translations[lang].slotReserved}</h4>
                    <p className="text-sm text-on-surface-variant">{translations[lang].slotReservedDesc}</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="w-full bg-white/5 text-on-surface py-5 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    {translations[lang].close}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const HeroAsset = ({ config }: { config: any }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <img 
        src={config.heroVideoFallback} 
        alt="NAITALK Frontier" 
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-1000 mix-blend-screen"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <video 
      key={config.heroVideoUrl}
      autoPlay 
      loop 
      muted 
      playsInline
      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-1000 mix-blend-screen"
      poster={config.heroVideoFallback}
      onError={() => setHasError(true)}
      src={config.heroVideoUrl}
    >
      Your browser does not support the video tag.
    </video>
  );
};

const Hero = ({ lang, config }: { lang: string, config: any }) => {
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  return (
    <section className="relative pt-24 pb-20 overflow-hidden bg-background text-on-surface">
      <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} lang={lang} />
      
      <div className="max-w-[1920px] mx-auto px-6 md:px-12 relative z-10">
        {/* Top Section: Split Grid mirroring the screenshot's first row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-24 items-start mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="w-full lg:max-w-[380px]"
          >
            <div className="aspect-square rounded-[2rem] overflow-hidden glass-panel border-white/5 relative group shadow-2xl">
              <HeroAsset config={config} />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <span className="text-[10px] font-display uppercase tracking-[0.2em] text-primary">Live Innovation</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex flex-col justify-end h-full"
          >
            <h1 className="text-[10vw] lg:text-[6.5vw] font-display font-medium leading-[0.85] tracking-tighter text-on-surface lowercase pr-4">
              {translations[lang].heroTitle}
            </h1>
          </motion.div>
        </div>

        {/* Middle Section: THE MASSIVE TEXT (The bold centerpiece) */}
        <div className="relative overflow-hidden select-none pointer-events-none my-8 md:my-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[20vw] md:text-[18vw] font-display font-black leading-[0.7] tracking-tighter text-transparent uppercase text-center relative group"
            style={{
              WebkitTextStroke: "1px rgba(255, 255, 255, 0.1)",
              backgroundImage: "linear-gradient(135deg, #90da49 0%, #6366f1 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              textShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 80px rgba(99, 102, 241, 0.2)",
              filter: "drop-shadow(0 0 10px rgba(99, 102, 241, 0.1))"
            }}
          >
            NAITALK
          </motion.div>
        </div>

        {/* Action Row: Replicating the screenshot's middle row but more compact */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-center py-8 border-t border-white/10">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-lg md:text-2xl text-on-surface-variant font-light leading-relaxed max-w-3xl">
              {translations[lang].heroDesc}
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            <button 
              onClick={() => setIsBookingOpen(true)}
              className="bg-gradient-to-r from-primary to-secondary text-on-primary px-12 py-6 rounded-full font-display font-bold uppercase tracking-widest text-xs hover:brightness-110 shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all active:scale-95"
            >
              {translations[lang].bookAudit}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Atmospheric Background Layers */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-secondary/10 blur-[150px] rounded-full pointer-events-none"></div>
    </section>
  );
};

const Stats = ({ lang }: { lang: string }) => (
  <section className="py-24 bg-surface-container-lowest">
    <div className="max-w-[1440px] mx-auto px-6 md:px-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { label: lang === "EN" ? "Global Projects" : lang === "DE" ? "Globale Projekte" : lang === "ZH" ? "全球项目" : "Projets Mondiaux", value: "150+" },
          { label: lang === "EN" ? "Enterprises" : lang === "DE" ? "Unternehmen" : lang === "ZH" ? "企业" : "Entreprises", value: "50+" },
          { label: lang === "EN" ? "Retention" : lang === "DE" ? "Kundenbindung" : lang === "ZH" ? "留存率" : "Rétention", value: "99%" },
          { label: lang === "EN" ? "Support" : lang === "DE" ? "Support" : lang === "ZH" ? "支持" : "Support", value: "24/7" }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className="glass-panel p-10 rounded-2xl text-center space-y-2 group hover:border-secondary/30 transition-all"
          >
            <div className={`text-5xl font-black tracking-tighter transition-colors ${i % 2 === 0 ? "text-primary" : "text-secondary"}`}>{stat.value}</div>
            <div className="text-xs font-label uppercase tracking-[0.2em] text-on-surface-variant">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const About = ({ lang }: { lang: string }) => (
  <section className="py-32 relative overflow-hidden" id="about">
    <div className="max-w-[1440px] mx-auto px-6 md:px-12">
      <div className="grid lg:grid-cols-2 gap-24 items-center">
        <div className="space-y-10">
          <div className="space-y-4">
            <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].philosophy}</span>
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tighter text-on-surface">{translations[lang].aboutTitle}</h2>
          </div>
          <p className="text-xl text-on-surface-variant font-light leading-relaxed">
            {translations[lang].aboutDesc}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { icon: Lightbulb, title: "Innovation", desc: "Pushing technological boundaries daily." },
              { icon: ShieldCheck, title: "Reliability", desc: "Mission-critical uptime and security." },
              { icon: TrendingUp, title: "Scalability", desc: "Architectures that grow with you." },
              { icon: Globe, title: "Global Reach", desc: "Optimized for international performance." }
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-4">
                <feature.icon className="text-primary w-8 h-8 shrink-0" />
                <div>
                  <div className="font-bold text-on-surface uppercase text-sm tracking-wider">{feature.title}</div>
                  <div className="text-sm text-on-surface-variant">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-transparent opacity-20 blur-2xl group-hover:opacity-40 transition-opacity"></div>
          <img 
            className="rounded-3xl w-full h-[600px] object-cover relative z-10 glass-panel" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_7HB_v3nVNNPBELP4exg_p2TGlFcU8LMBV94o-y4ozTXuc_c-Jy6CPaLp3K0sXG-RWFIpPKZtGSFHtv23_O5tNikVjUe_kqiElfOKGJ4fuTofJCcHp0666r8ZS_cUXeavtIgGgOcXB35hB8_n7gdVinS8LZ79HVEg9ZsA1kUvlPPEYnc5iABaoBBy3OqJLtLd5h6okdwN7YxqRdSAKEMZHGonT5H8iDSRZ2vVLJa9LORhqI58c4-4V-AF4Lk3hKt-wEyXurB14MQ"
            referrerPolicy="no-referrer"
            alt="Server room"
          />
        </div>
      </div>
    </div>
  </section>
);

const Services = ({ lang }: { lang: string }) => (
  <section className="py-32 bg-surface-container-lowest" id="services">
    <div className="max-w-[1440px] mx-auto px-6 md:px-12">
      <div className="text-center mb-24 space-y-4">
        <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].coreCapabilities}</span>
        <h2 className="text-5xl font-black tracking-tighter text-on-surface" id="ecosystem">{translations[lang].serviceEcosystem}</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          { icon: Terminal, title: "Software Dev", desc: "Bespoke enterprise applications engineered with Go, Rust, and Python for maximum performance." },
          { icon: Smartphone, title: "Web & Mobile", desc: "Immersive cross-platform experiences using React Native and Next.js with atomic design principles." },
          { icon: Brain, title: "AI Integration", desc: "Custom LLM fine-tuning and predictive analytics pipelines to automate intelligence." },
          { icon: CreditCard, title: "Naipay", desc: "Secure, high-throughput financial infrastructure with global compliance standards." },
          { icon: Lock, title: "IT Consulting", desc: "Strategic digital transformation and cybersecurity audits for high-growth firms." }
        ].map((service, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            whileHover={{ y: -10 }}
            className="glass-panel p-10 rounded-2xl hover:bg-white/5 transition-all group flex flex-col h-full hover:border-secondary/20"
          >
            <service.icon className={`w-12 h-12 mb-8 ${i % 2 === 0 ? "text-primary" : "text-secondary"}`} />
            <h3 className="text-2xl font-bold text-on-surface mb-4">{service.title}</h3>
            <p className="text-on-surface-variant font-light mb-8 flex-grow">{service.desc}</p>
            <div className={`h-1 w-12 transition-all duration-500 group-hover:w-full ${i % 2 === 0 ? "bg-primary" : "bg-secondary"}`}></div>
          </motion.div>
        ))}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.5 }}
          whileHover={{ y: -10 }}
          className="glass-panel p-10 rounded-2xl hover:bg-white/5 transition-all group flex flex-col h-full"
        >
          <Globe className="w-12 h-12 text-primary mb-8" />
          <h3 className="text-2xl font-bold text-on-surface mb-4">{translations[lang].webHosting}</h3>
          <p className="text-on-surface-variant font-light mb-8 flex-grow">{translations[lang].webHostingDesc}</p>
          <div className="h-1 w-12 bg-primary group-hover:w-full transition-all duration-500"></div>
        </motion.div>
      </div>
    </div>
  </section>
);

const Portfolio = ({ lang }: { lang: string }) => {
  const [filter, setFilter] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const response = await fetch("/data/portfolio.json");
        const data = await response.json();
        setProjects(data.projects);
      } catch (error) {
        console.error("Failed to fetch portfolio:", error);
        // Fallback to static data if fetch fails
        setProjects([
          { 
            category: "Cloud Infrastructure", 
            title: "University Cloud", 
            img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDxoRic5ruxIju7ZosAn7MPx8j5aM_qmRXp2DAwcn1RAq0wyIEab-q4RWJJWNWm_jKjwqcI68lnsMK-3atC_y-jyayNNo8I0Xl92ewPz31MakJDaSR_C5TImRIo8R-nZJX1kqcbG-dgoNgpE8gn9-TysSUolE4PlZJ7ivMLAPoJz1GuywAKOR70hwHsT7t9VUxQfIvXFDBczSXk76-KAGk1NLAj9spJbLruhjkj0KETJw1ctkldGsZqNoZbJDlNWFVfGYaLXnuKwf0",
            details: {
              challenge: "A major university needed to migrate 50+ legacy applications to a zero-trust cloud environment without downtime.",
              solution: "We architected a multi-region Kubernetes cluster with automated failover and integrated biometric authentication for admin access.",
              roi: "40% reduction in operational costs and 99.99% uptime achieved within the first quarter."
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Handle Initial Deep Link
  useEffect(() => {
    if (!loading && projects.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const projectTitle = params.get('project');
      if (projectTitle) {
        const project = projects.find(p => p.title === projectTitle);
        if (project) {
          setSelectedProject(project);
          document.getElementById('portfolio')?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [loading, projects]);

  const categories = ["All", ...new Set(projects.flatMap(p => p.category.split(',').map((c: string) => c.trim())))];

  const filteredProjects = filter === "All" 
    ? projects 
    : projects.filter(p => p.category.split(',').map((c: string) => c.trim()).includes(filter));

  useEffect(() => {
    if (filteredProjects.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % filteredProjects.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [filteredProjects.length]);

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('project', selectedProject.title);
    navigator.clipboard.writeText(url.toString());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const next = () => setCurrentIndex((prev) => (prev + 1) % filteredProjects.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + filteredProjects.length) % filteredProjects.length);

  if (loading || projects.length === 0) return null;

  return (
    <section className="py-32" id="portfolio">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="space-y-4 max-w-2xl">
            <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].caseStudies}</span>
            <h2 className="text-5xl font-black tracking-tighter text-on-surface">{translations[lang].thePortfolio}</h2>
          </div>
          <div className="flex gap-4">
            <button onClick={prev} className="p-4 rounded-full glass-panel hover:bg-secondary transition-all group">
              <ArrowLeft className="w-6 h-6 group-hover:text-on-secondary" />
            </button>
            <button onClick={next} className="p-4 rounded-full glass-panel hover:bg-secondary transition-all group">
              <ArrowRight className="w-6 h-6 group-hover:text-on-secondary" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setFilter(cat); setCurrentIndex(0); }}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                filter === cat ? "bg-secondary text-on-secondary shadow-lg shadow-secondary/10" : "glass-panel text-on-surface-variant hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden">
          <motion.div 
            className="flex gap-10"
            animate={{ x: `-${currentIndex * (100 / (window.innerWidth < 768 ? 1 : 3))}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {filteredProjects.map((project, i) => (
              <motion.div 
                key={i}
                onClick={() => setSelectedProject(project)}
                className="min-w-full md:min-w-[calc(33.333%-27px)] group relative overflow-hidden rounded-3xl aspect-[4/5] cursor-pointer"
              >
                <img 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100" 
                  src={project.img}
                  referrerPolicy="no-referrer"
                  alt={project.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                <div className="absolute bottom-0 p-10 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {project.category.split(',').map((c: string) => (
                      <span key={c} className="text-primary font-bold uppercase tracking-[0.2em] text-[9px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                        {c.trim()}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-3xl font-black text-on-surface">{project.title}</h3>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 bg-black/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[3rem] border-primary/20 p-8 md:p-16 relative"
            >
              <button 
                onClick={() => setSelectedProject(null)}
                className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <ChevronDown className="w-6 h-6 rotate-180" />
              </button>

              <div className="grid lg:grid-cols-2 gap-16">
                <div className="space-y-10">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.category.split(',').map((c: string) => (
                        <span key={c} className="text-primary font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                          {c.trim()}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-5xl font-black tracking-tighter text-on-surface">{selectedProject.title}</h3>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">The Challenge</div>
                      <p className="text-lg text-on-surface font-light leading-relaxed">{selectedProject.details.challenge}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">The Solution</div>
                      <p className="text-lg text-on-surface font-light leading-relaxed">{selectedProject.details.solution}</p>
                    </div>
                    <div className="p-8 bg-primary/5 rounded-2xl border border-primary/10 flex gap-6 items-center">
                      <TrendingUp className="w-10 h-10 text-primary" />
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-primary">Impact & ROI</div>
                        <div className="text-xl font-bold text-on-surface">{selectedProject.details.roi}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <img 
                    src={selectedProject.img} 
                    className="w-full aspect-video object-cover rounded-[2rem] border border-white/5" 
                    alt={selectedProject.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 glass-panel rounded-2xl border-white/5">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Timeline</div>
                      <div className="text-lg font-bold text-on-surface">4 Months</div>
                    </div>
                    <div className="p-6 glass-panel rounded-2xl border-white/5">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Team Size</div>
                      <div className="text-lg font-bold text-on-surface">6 Engineers</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button className="flex-1 bg-primary text-on-primary py-5 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all">
                      Request Full Case Study
                    </button>
                    <button 
                      onClick={handleShare}
                      className="w-16 h-16 glass-panel flex items-center justify-center rounded-xl hover:bg-white/10 transition-all relative group"
                    >
                      <Share2 className={`w-6 h-6 transition-all ${copySuccess ? 'text-primary scale-110' : 'text-on-surface'}`} />
                      <AnimatePresence>
                        {copySuccess && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-3 py-1 rounded text-[10px] font-bold whitespace-nowrap"
                          >
                            {translations[lang].linkCopied}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const ProjectEstimator = ({ lang }: { lang: string }) => {
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [estimatorConfig, setEstimatorConfig] = useState<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/data/estimator.json")
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then(data => setEstimatorConfig(data))
      .catch(err => {
        console.error("Failed to load estimator config", err);
        // Minimal fallback config to prevent crash
        setEstimatorConfig({
          industries: { "E-commerce": { multiplier: 1, insight: "Growth focus", deliverables: ["Scaling"] } },
          goals: { "Automation": { baseWeeks: 4, steps: ["Goal setup"], insight: "Efficiency", deliverables: ["Automations"] } },
          severityTriggers: { keywordWeights: {}, maxDurationWeeks: 12 },
          strategicAdvice: ["Start small, scale fast."]
        });
      });
  }, []);

  const generateRoadmap = async () => {
    if (!industry || !goal || !estimatorConfig) return;
    setLoading(true);
    setResult(null);

    // Simulate "thinking" time for the custom AI
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const industryData = estimatorConfig.industries[industry];
      const goalData = estimatorConfig.goals[goal];
      
      // Calculate severity/duration
      let baseWeeks = goalData.baseWeeks;
      let multiplier = industryData.multiplier;
      let calculatedWeeks = baseWeeks * multiplier;

      // Scan details for keywords to increase severity
      const detailsLower = details.toLowerCase();
      Object.entries(estimatorConfig.severityTriggers.keywordWeights).forEach(([keyword, weight]) => {
        if (detailsLower.includes(keyword)) {
          calculatedWeeks += (weight as number);
        }
      });

      // Cap at 4 months (16 weeks)
      const finalWeeks = Math.min(Math.ceil(calculatedWeeks), 16);
      
      let timelineStr = "";
      if (goal === "Webhosting & SSL" && finalWeeks <= 1) {
        timelineStr = "48 Hours";
      } else {
        const months = Math.ceil(finalWeeks / 4);
        timelineStr = `${finalWeeks} Weeks (~${months} Month${months > 1 ? 's' : ''})`;
      }

      // Pick a random advice
      const advice = estimatorConfig.strategicAdvice[Math.floor(Math.random() * estimatorConfig.strategicAdvice.length)];

      const localResult = {
        roadmap: goalData.steps,
        estimatedTimeline: timelineStr,
        deliverables: goalData.deliverables || industryData.deliverables,
        expertInsight: goalData.insight || industryData.insight,
        strategicAdvice: advice
      };

      setResult(localResult);
      
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("Estimation Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-32 bg-surface-container-lowest" id="estimator">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-24 items-start">
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].aiInsights}</span>
              <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-on-surface">{translations[lang].projectEstimator}</h2>
              <p className="text-xl text-on-surface-variant font-light leading-relaxed">
                {translations[lang].estimatorDesc}
              </p>
            </div>

            <div className="glass-panel p-8 md:p-12 rounded-[2rem] space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">{translations[lang].industry}</label>
                  <select 
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-surface-container-low border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface transition-all py-4 appearance-none"
                  >
                    <option value="">{translations[lang].selectIndustry}</option>
                    <option value="Fintech">Fintech</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Advertising Media">Advertising Media</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">{translations[lang].primaryGoal}</label>
                  <select 
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full bg-surface-container-low border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface transition-all py-4 appearance-none"
                  >
                    <option value="">{translations[lang].selectGoal}</option>
                    <option value="Automation">AI Automation</option>
                    <option value="Scalability">Global Scalability</option>
                    <option value="Security Hardening">Security Hardening</option>
                    <option value="Modernization">Legacy Modernization</option>
                    <option value="Web/Software Development">Web/Software Development</option>
                    <option value="Webhosting & SSL">Webhosting & SSL</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Debugging">Debugging</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">{translations[lang].additionalContext}</label>
                <textarea 
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full bg-surface-container-low border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface placeholder:text-surface-variant transition-all py-4 resize-none" 
                  placeholder={translations[lang].describeRequirements} 
                  rows={3}
                ></textarea>
              </div>
              <button 
                onClick={generateRoadmap}
                disabled={loading || !industry || !goal}
                className="w-full bg-gradient-to-r from-secondary to-secondary-container text-on-secondary py-6 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-secondary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {translations[lang].architecting}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {translations[lang].generateRoadmap}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative min-h-[500px]">
            <AnimatePresence mode="wait">
              {!result && !loading && (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-6 glass-panel rounded-[2rem] border-dashed border-2 border-white/10"
                >
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                    <Brain className="w-10 h-10 text-on-surface-variant opacity-20" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xl font-bold text-on-surface-variant opacity-40">{translations[lang].awaitingParameters}</div>
                    <p className="text-sm text-on-surface-variant opacity-30 max-w-xs">{translations[lang].fillDetails}</p>
                  </div>
                </motion.div>
              )}

              {loading && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-8 glass-panel rounded-[2rem]"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-black tracking-tighter text-primary">{translations[lang].analyzingEcosystem}</div>
                    <p className="text-sm text-on-surface-variant animate-pulse">{translations[lang].synthesizing}</p>
                  </div>
                </motion.div>
              )}

              {result && (
                <motion.div 
                  key="result"
                  ref={resultRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel p-10 rounded-[2rem] space-y-10 border-primary/20"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-primary font-bold uppercase tracking-widest text-[10px]">{translations[lang].technicalBlueprint}</div>
                      <h3 className="text-3xl font-black tracking-tighter text-on-surface">{translations[lang].theRoadmap}</h3>
                    </div>
                    <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">
                      {result.estimatedTimeline}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {result.roadmap.map((step: string, i: number) => (
                      <div key={i} className="flex gap-6 items-start">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-on-surface leading-relaxed pt-1">{step}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 border-t border-white/5 space-y-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{translations[lang].keyDeliverables}</div>
                        <div className="flex flex-wrap gap-2">
                          {result.deliverables.map((item: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-white/5 rounded-md text-[10px] font-bold text-on-surface-variant border border-white/5">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{translations[lang].expertInsight}</div>
                        <p className="text-sm italic font-light text-on-surface-variant leading-relaxed border-l-2 border-primary/30 pl-4">
                          "{result.expertInsight}"
                        </p>
                      </div>
                    </div>
                    <div className="p-6 bg-primary/5 rounded-xl border border-primary/10 flex gap-4 items-start">
                      <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-primary">{translations[lang].strategicAdvice}</div>
                        <p className="text-sm text-primary/80 italic">"{result.strategicAdvice}"</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

const IntelligenceFeed = ({ lang }: { lang: string }) => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news");
        if (!response.ok) throw new Error("API response not ok");
        
        const data = await response.json();
        if (data && data.articles && data.articles.length > 0) {
          // Always take exactly 3 articles
          const topThree = data.articles.slice(0, 3);
          setArticles(topThree.map((a: any) => ({
            date: new Date(a.publishedAt).toLocaleDateString(lang === "ZH" ? "zh-CN" : lang === "FR" ? "fr-FR" : lang === "DE" ? "de-DE" : "en-US", { month: 'short', day: 'numeric', year: 'numeric' }),
            category: a.source.name || "Tech",
            title: a.title,
            excerpt: a.description || "No description available.",
            author: a.author || "Tech News",
            readTime: "5 min read",
            url: a.url,
            image: a.urlToImage
          })));
        }
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [lang]);

  if (loading) {
    return (
      <section className="py-32" id="insights">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 w-24 mx-auto rounded"></div>
            <div className="h-12 bg-white/10 w-64 mx-auto rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-32" id="insights">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <div className="space-y-4 max-w-2xl">
            <span className="text-primary font-bold uppercase tracking-widest text-xs">Thought Leadership</span>
            <h2 className="text-5xl font-black tracking-tighter text-on-surface">{translations[lang].intelligenceFeed}</h2>
          </div>
          <button className="text-primary font-bold uppercase tracking-widest text-xs border-b border-primary pb-1 hover:text-white hover:border-white transition-all">{translations[lang].readMore}</button>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {articles.map((article, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group cursor-pointer"
              onClick={() => article.url && window.open(article.url, "_blank")}
            >
              <div className="glass-panel overflow-hidden rounded-[2rem] h-full flex flex-col hover:bg-white/5 transition-all border-white/5 group-hover:border-primary/20">
                <div className="h-64 overflow-hidden relative">
                  <img 
                    src={article.image || "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800"} 
                    alt={article.title}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-6 left-6 flex gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-background/80 backdrop-blur-md px-3 py-1 rounded-md">{article.category}</span>
                  </div>
                </div>
                <div className="p-8 space-y-8 flex flex-col flex-grow">
                  <div className="space-y-4 flex-grow">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">{article.date}</div>
                    <h3 className="text-2xl font-bold text-on-surface leading-tight group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                    <p className="text-on-surface-variant font-light leading-relaxed line-clamp-3">{article.excerpt}</p>
                  </div>
                  <div className="pt-8 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-white/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {article.author.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="text-xs font-bold text-on-surface-variant">{article.author}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-30">{article.readTime}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const UserAvatar = ({ src, name }: { src: string; name: string }) => {
  const [error, setError] = useState(false);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold overflow-hidden">
      {!error && src ? (
        <img
          className="w-full h-full object-cover"
          src={src}
          referrerPolicy="no-referrer"
          alt={name}
          onError={() => setError(true)}
        />
      ) : (
        <span className="text-xl">{initials}</span>
      )}
    </div>
  );
};

const Testimonials = ({ lang }: { lang: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("/api/reviews");
        if (!response.ok) throw new Error("API response not ok");
        
        const data = await response.json();
        if (data && data.reviews && data.reviews.length > 0) {
          setReviews(data.reviews.map((r: any) => ({
            text: r.text,
            author: r.author_name,
            role: r.role || "Verified Client",
            img: r.profile_photo_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuCD1KNCXxHTac4Egv-dNz6nF65rSZb-19bXUWwKfhnn7v5YIQCJyhiaDyD-Qnn6DNFwYCnL2Q16RKHd6cM4y71I3YReXU0mBbnxeQlhJaeqa_GIbZNingdGsCi21UWC6BwyEmZKTIGysiry7gwxSoxGXjsUTxOo6MXG4v3_THZGdBBSzMklMRJcKfromN6lQ-G4Ahc5p7svh_UU6lf1kkNx7NXKchTP4b5DtCodqWkZs6kap3rhwTszUYTziLkWp_nvFag5pWxgQbE",
            time: r.relative_time_description
          })));
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  useEffect(() => {
    if (reviews.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % reviews.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [reviews.length]);

  if (loading || reviews.length === 0) {
    return (
      <section className="py-32 bg-surface-container-lowest" id="testimonials">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 w-24 mx-auto rounded"></div>
            <div className="h-12 bg-white/10 w-64 mx-auto rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-32 bg-surface-container-lowest overflow-hidden" id="testimonials">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="flex flex-col items-center text-center mb-24 space-y-4">
          <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].clientVoices}</span>
          <h2 className="text-5xl font-black tracking-tighter text-on-surface">{translations[lang].testimonialsTitle}</h2>
        </div>
        <div className="max-w-4xl mx-auto relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="glass-panel p-8 md:p-16 rounded-[2rem] relative"
            >
              <Quote className="w-24 h-24 text-primary/10 absolute top-10 right-10" />
              <div className="space-y-10 relative z-10">
                <p className="text-2xl md:text-3xl font-light leading-snug text-on-surface italic">
                  "{reviews[currentIndex].text}"
                </p>
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary">
                    <UserAvatar 
                      src={reviews[currentIndex].img} 
                      name={reviews[currentIndex].author} 
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-bold text-on-surface">{reviews[currentIndex].author}</div>
                      <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] font-bold text-primary border border-primary/20">
                        <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" className="h-2.5 grayscale brightness-200" alt="Google" />
                        <span>VERIFIED</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm uppercase tracking-widest text-primary">{reviews[currentIndex].role}</div>
                      {reviews[currentIndex].time && (
                        <>
                          <div className="w-1 h-1 rounded-full bg-white/20"></div>
                          <div className="text-[10px] text-on-surface-variant opacity-50">{reviews[currentIndex].time}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-center gap-3 mt-12">
            {reviews.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentIndex(i)}
                className={`w-3 h-3 rounded-full transition-all ${currentIndex === i ? "bg-primary w-8" : "bg-white/10"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Contact = ({ lang }: { lang: string }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "AI Integration",
    details: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const validate = (name: string, value: string) => {
    let error = "";
    if (name === "name") {
      if (!value.trim()) error = lang === "ZH" ? "姓名是必填项" : lang === "FR" ? "Le nom est requis" : lang === "DE" ? "Name ist erforderlich" : "Name is required";
      else if (value.length < 2) error = lang === "ZH" ? "姓名太短" : lang === "FR" ? "Le nom est trop court" : lang === "DE" ? "Name ist zu kurz" : "Name is too short";
    } else if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.trim()) error = lang === "ZH" ? "电子邮件是必填项" : lang === "FR" ? "L'e-mail est requis" : lang === "DE" ? "E-Mail ist erforderlich" : "Email is required";
      else if (!emailRegex.test(value)) error = lang === "ZH" ? "电子邮件格式无效" : lang === "FR" ? "Format d'e-mail invalide" : lang === "DE" ? "Ungültiges E-Mail-Format" : "Invalid email format";
    } else if (name === "details") {
      if (!value.trim()) error = lang === "ZH" ? "项目详情是必填项" : lang === "FR" ? "Les détails du projet sont requis" : lang === "DE" ? "Projektdetails sind erforderlich" : "Project details are required";
      else if (value.length < 10) error = lang === "ZH" ? "请提供更多详情" : lang === "FR" ? "Veuillez fournir plus de détails" : lang === "DE" ? "Bitte geben Sie mehr Details an" : "Please provide more details";
    }
    return error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    const error = validate(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach(key => {
      const error = validate(key, (formData as any)[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setStatus("success");
        setMessage(translations[lang].messageSent);
        setFormData({ name: "", email: "", service: "AI Integration", details: "" });
      } else {
        throw new Error(data.error || translations[lang].messageError);
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : translations[lang].messageError);
    }
  };

  return (
    <section className="py-32" id="contact">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-2 gap-24">
          <div className="space-y-12">
            <div className="space-y-4">
              <span className="text-primary font-bold uppercase tracking-widest text-xs">{translations[lang].getInTouch}</span>
              <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-on-surface">{translations[lang].contactTitle}</h2>
              <p className="text-xl text-on-surface-variant font-light leading-relaxed max-w-md">
                {translations[lang].contactDesc}
              </p>
            </div>
            <div className="space-y-8">
              <div className="flex gap-6 items-center">
                <div className="w-12 h-12 glass-panel rounded-lg flex items-center justify-center">
                  <Smartphone className="text-primary w-6 h-6" />
                </div>
                <span className="text-xl font-light">+2347087057654</span>
              </div>
              <div className="flex gap-6 items-center">
                <div className="w-12 h-12 glass-panel rounded-lg flex items-center justify-center">
                  <Mail className="text-primary w-6 h-6" />
                </div>
                <span className="text-xl font-light">info@naitalk.com</span>
              </div>
              <div className="flex gap-6 items-center">
                <div className="w-12 h-12 glass-panel rounded-lg flex items-center justify-center">
                  <MapPin className="text-primary w-6 h-6" />
                </div>
                <span className="text-xl font-light">7 unity rd, off baale street,ikola,Lagos</span>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden glass-panel h-[300px]">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3963.176424464172!2d3.246970074115784!3d6.624995621977392!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103b9a71c0022179%3A0x9995260dae04b06e!2sNaiTalk%20Software%20Solutions!5e0!3m2!1sen!2sng!4v1776194429277!5m2!1sen!2sng" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
            <a 
              className="inline-flex items-center gap-4 bg-[#25D366]/10 text-[#25D366] px-8 py-4 rounded-xl border border-[#25D366]/20 font-bold tracking-widest text-xs uppercase hover:bg-[#25D366]/20 transition-all" 
              href="https://wa.me/2347087057654"
            >
              <MessageSquare className="w-5 h-5" />
              Chat via WhatsApp
            </a>
          </div>
          <div className="glass-panel p-8 md:p-12 rounded-[2rem] bg-surface-container-low">
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">Full Name</label>
                <input 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full bg-surface-container-lowest border-0 border-b ${errors.name ? 'border-red-500' : 'border-outline-variant'} focus:border-primary focus:ring-0 text-on-surface placeholder:text-surface-variant transition-all py-4`} 
                  placeholder="John Doe" 
                  type="text"
                />
                {errors.name && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">Email Address</label>
                <input 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full bg-surface-container-lowest border-0 border-b ${errors.email ? 'border-red-500' : 'border-outline-variant'} focus:border-primary focus:ring-0 text-on-surface placeholder:text-surface-variant transition-all py-4`} 
                  placeholder="john@nexus.com" 
                  type="email"
                />
                {errors.email && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">Service Required</label>
                <div className="relative">
                  <select 
                    name="service"
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface transition-all py-4 appearance-none"
                  >
                    <option>AI Integration</option>
                    <option>Software Development</option>
                    <option>Web & Mobile Development</option>
                    <option>Fintech Infrastructure</option>
                    <option>Cybersecurity Audit</option>
                    <option>Cloud Migration</option>
                    <option>Web Hosting</option>
                    <option>IT Consulting</option>
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant">Project Details</label>
                <textarea 
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  className={`w-full bg-surface-container-lowest border-0 border-b ${errors.details ? 'border-red-500' : 'border-outline-variant'} focus:border-primary focus:ring-0 text-on-surface placeholder:text-surface-variant transition-all py-4 resize-none`} 
                  placeholder={translations[lang].describeRequirements} 
                  rows={4}
                ></textarea>
                {errors.details && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.details}</p>}
              </div>
              
              <div className="space-y-4">
                <button 
                  disabled={status === "loading"}
                  className="w-full bg-primary-container text-on-primary py-6 rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-primary/10 disabled:opacity-50"
                >
                  {status === "loading" ? translations[lang].sending : translations[lang].submitProtocol}
                </button>
                
                {status === "success" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{message}</p>
                  </motion.div>
                )}
                
                {status === "error" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{message}</p>
                  </motion.div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = ({ lang }: { lang: string }) => (
  <footer className="bg-[#0e0e0e] border-t border-white/5">
    <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-12 w-full max-w-[1920px] mx-auto">
      <div className="mb-8 md:mb-0 text-center md:text-left">
        <Logo className="mb-4" />
        <p className="font-manrope text-[10px] tracking-widest uppercase text-[#353534]">© 2024 NAITALK. {translations[lang].allRightsReserved}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-6 md:gap-10">
        {["Privacy Policy", "Terms of Service"].map((link) => (
          <a key={link} className="font-manrope text-[10px] tracking-widest uppercase text-[#353534] hover:text-[#90da49] transition-colors" href="#">{link}</a>
        ))}
      </div>
      <div className="flex gap-4 mt-8 md:mt-0">
        <a href="#" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:text-primary transition-all" aria-label="LinkedIn">
          <Linkedin className="w-5 h-5" />
        </a>
        <a href="#" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:text-primary transition-all" aria-label="Facebook">
          <Facebook className="w-5 h-5" />
        </a>
        <a href="#" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:text-primary transition-all" aria-label="X (formerly Twitter)">
          <Twitter className="w-5 h-5" />
        </a>
      </div>
    </div>
  </footer>
);

export default function App() {
  const [lang, setLang] = useState("EN");
  const [config, setConfig] = useState({ 
    heroVideoUrl: "/data/hero-video.mp4",
    heroVideoFallback: "https://lh3.googleusercontent.com/aida-public/AB6AXuAAy1V06620d17PxmJ8nG7wQNKroM25xNP1ySpnAIpLkoItsxQctIOhMzo--TOwBtbUO3IsWXcQMprmsrG1hFfUrp4M4n0XvrBrqxd869l2A1lPwawi5O3_JbphUQjNLzCp7yntKV3QD7Eh7HnNo9gLqI0ffYcQu6cko4-l3NY-yN3BG4Yavo_gmcGXu-FmEzf2Xnx1jcWPILrOhZn9NVSfbdju5Xdbdeiq4qCRNxRclKpliW0BE4aVK76Hziaj6O81O10uMhflePw"
  });

  useEffect(() => {
    fetch("/data/config.json")
      .then(res => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        throw new Error("Response was not JSON");
      })
      .then(data => setConfig(data))
      .catch(err => {
        console.warn("Using default config as /data/config.json could not be loaded:", err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary selection:text-on-primary">
      <Navbar lang={lang} setLang={setLang} />
      <ScrollToTop />
      <main>
        <Hero lang={lang} config={config} />
        <Stats lang={lang} />
        <About lang={lang} />
        <Services lang={lang} />
        <Portfolio lang={lang} />
        <ProjectEstimator lang={lang} />
        <IntelligenceFeed lang={lang} />
        <Testimonials lang={lang} />
        <Contact lang={lang} />
      </main>
      <Footer lang={lang} />
    </div>
  );
}
