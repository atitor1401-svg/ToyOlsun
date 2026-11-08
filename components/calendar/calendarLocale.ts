// Month/day names for react-native-calendars in the app's three languages.
// Call useCalendarLocale(lang) in any screen that shows a <Calendar>.
import { useEffect } from 'react';
import { LocaleConfig } from 'react-native-calendars';
import type { Language } from '@/app/(tabs)/index';

LocaleConfig.locales.az = {
    monthNames: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'],
    monthNamesShort: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'],
    dayNames: ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'],
    dayNamesShort: ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'],
    today: 'Bu gün',
};
LocaleConfig.locales.ru = {
    monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    today: 'Сегодня',
};
LocaleConfig.locales.en = LocaleConfig.locales[''];

export function setCalendarLocale(lang: Language) {
    LocaleConfig.defaultLocale = lang === 'en' ? '' : lang;
}

export function useCalendarLocale(lang: Language) {
    setCalendarLocale(lang); // synchronously, so the first render already uses it
    useEffect(() => { setCalendarLocale(lang); }, [lang]);
}

export const CALENDAR_THEME = {
    todayTextColor: '#B8932F',
    arrowColor: '#2C2623',
    selectedDayBackgroundColor: '#2C2623',
    textDayFontSize: 15,
    textMonthFontSize: 16,
    textMonthFontWeight: '600' as const,
    calendarBackground: 'transparent',
};
