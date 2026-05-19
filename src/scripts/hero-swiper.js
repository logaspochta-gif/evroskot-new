import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

document.addEventListener('DOMContentLoaded', () => {
  const el = document.querySelector('.hero-swiper');
  if (!el) return;

  const swiper = new Swiper(el, {
    modules: [Navigation, Pagination, Autoplay],
    loop: true,
    speed: 800,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });

  // Функция для запуска анимации на активном слайде
  function animateSlide(slide) {
    slide.querySelectorAll('.anim-fade-up').forEach((el) => {
      el.classList.add('animated');
    });
  }

  // Анимация первого слайда сразу после инициализации
  const activeSlide = swiper.slides[swiper.activeIndex];
  if (activeSlide) animateSlide(activeSlide);

  // Анимация при смене слайда
  swiper.on('slideChangeTransitionStart', () => {
    // Удаляем класс со всех слайдов
    swiper.slides.forEach((slide) => {
      slide.querySelectorAll('.anim-fade-up').forEach((el) => {
        el.classList.remove('animated');
      });
    });
    // Даём браузеру мгновение перерисовать, затем анимируем новый слайд
    requestAnimationFrame(() => {
      const newActive = swiper.slides[swiper.activeIndex];
      if (newActive) animateSlide(newActive);
    });
  });
});