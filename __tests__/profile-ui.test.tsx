import React from 'react';
import {act,cleanup,fireEvent,renderRouter,screen,waitFor} from 'expo-router/testing-library';
import {Stack,router} from 'expo-router';
import ProfileDetails from '../src/components/ProfileDetails';
import AvatarThumbnail from '../src/components/AvatarThumbnail';
import {getProfile,saveNickname} from '../src/profile/profileApi';
import {getAvatar} from '../src/avatar/avatarApi';
import {WorkoutApiError} from '../src/workouts/workoutApi';
const mockSignOut=jest.fn();
jest.mock('../src/auth/SessionProvider',()=>({useSession:()=>({token:'test-token',signOut:mockSignOut})}));
jest.mock('../src/profile/profileApi',()=>({getProfile:jest.fn(),saveNickname:jest.fn()}));
jest.mock('../src/avatar/avatarApi',()=>({...jest.requireActual('../src/avatar/avatarApi'),getAvatar:jest.fn()}));
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
const read=jest.mocked(getProfile),save=jest.mocked(saveNickname),avatar=jest.mocked(getAvatar);
const user={id:7,email:'demo@example.test',nickname:'Стас',createdAt:'2026-01-01T00:00:00Z'};
const profile=(year=2026,today='2026-10-23')=>({user,activity:{year,today,totalWorkouts:2,yearWorkouts:year===Number(today.slice(0,4))?2:0,activeDays:year===Number(today.slice(0,4))?1:0,days:year===Number(today.slice(0,4))?[{date:today,count:2}]:[]}});
beforeEach(()=>{read.mockReset().mockImplementation(async(_token,year,today)=>profile(year,today));save.mockReset().mockResolvedValue({...user,nickname:'Новий_нік'});avatar.mockReset().mockResolvedValue({url:'https://example.test/avatar.jpg',expiresAt:'2099-01-01T00:00:00Z'});mockSignOut.mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
const open=()=>renderRouter({_layout:()=> <Stack/>,index:()=> <ProfileDetails/>});
test('профіль показує email, редагує нікнейм та зберігає його через API',async()=>{
 await open();await screen.findByText('demo@example.test');expect(screen.getByLabelText('Нікнейм').props.value).toBe('Стас');
 await fireEvent.changeText(screen.getByLabelText('Нікнейм'),'Новий_нік');await fireEvent.press(screen.getByRole('button',{name:'Зберегти нікнейм'}));await screen.findByText('Нікнейм збережено.');
 expect(save).toHaveBeenCalledWith('test-token','Новий_нік',expect.any(AbortSignal));expect(screen.getByLabelText('Нікнейм').props.value).toBe('Новий_нік');
});
test('натискання дня показує кількість тренувань, вибір року завантажує потрібний календар',async()=>{
 await open();await screen.findByText('demo@example.test');
 const today=read.mock.calls[0][2];
 const display=today.split('-').reverse().join('.');
 await fireEvent.press(screen.getByRole('button',{name:`${display}: тренувань — 2`}));await screen.findByText(`${display} · виконаних тренувань: 2`);
 const year=read.mock.calls[0][1];await fireEvent.press(screen.getByRole('button',{name:'Попередній рік'}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(2));expect(read.mock.calls[1][1]).toBe(year-1);
});
test('незбережений нікнейм не зникає під час перемикання року',async()=>{
 await open();await screen.findByText('demo@example.test');await fireEvent.changeText(screen.getByLabelText('Нікнейм'),'Ще не збережено');
 await fireEvent.press(screen.getByRole('button',{name:'Попередній рік'}));await screen.findByText('demo@example.test');expect(screen.getByLabelText('Нікнейм').props.value).toBe('Ще не збережено');
});
test('збій профілю дозволяє повтор, а 401 завершує сесію',async()=>{
 read.mockRejectedValueOnce(new Error('offline'));await open();await screen.findByRole('alert');
 await fireEvent.press(screen.getByRole('button',{name:'Повторити завантаження профілю'}));await screen.findByText('demo@example.test');expect(mockSignOut).not.toHaveBeenCalled();
 read.mockRejectedValueOnce(new WorkoutApiError('Сесія',401));await fireEvent.press(screen.getByRole('button',{name:'Попередній рік'}));await waitFor(()=>expect(mockSignOut).toHaveBeenCalledTimes(1));
});
test('мініаватар відображається на головній, запит скасовується і фото оновлюється після повернення з профілю',async()=>{
 await renderRouter({_layout:()=> <Stack/>,index:()=> <AvatarThumbnail/>,profile:()=>null});
 await screen.findByLabelText('Мій мініаватар');expect(screen.getByLabelText('Мій мініаватар').props.source.uri).toBe('https://example.test/avatar.jpg');
 const signal=avatar.mock.calls[0][1];await act(async()=>router.push('/profile'));expect(signal.aborted).toBe(true);
 avatar.mockResolvedValue({url:'https://example.test/updated.jpg',expiresAt:'2099-01-01T00:00:00Z'});await act(async()=>router.back());
 await waitFor(()=>expect(screen.getByLabelText('Мій мініаватар').props.source.uri).toBe('https://example.test/updated.jpg'));
});

test('повернення після перерваного збереження нікнейму не залишає форму заблокованою',async()=>{
 let confirm!:(value:typeof user)=>void;
 save.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));
 await renderRouter({_layout:()=> <Stack/>,index:()=>null,profile:()=> <ProfileDetails/>},{initialUrl:'/profile'});
 await screen.findByText('demo@example.test');await fireEvent.changeText(screen.getByLabelText('Нікнейм'),'Новий_нік');
 await fireEvent.press(screen.getByRole('button',{name:'Зберегти нікнейм'}));const signal=save.mock.calls[0][2];
 await act(async()=>router.push('/'));expect(signal.aborted).toBe(true);await act(async()=>router.back());await screen.findByText('demo@example.test');
 expect(screen.getByLabelText('Нікнейм').props.editable).toBe(true);
 await act(async()=>confirm({...user,nickname:'Стара відповідь'}));expect(screen.getByLabelText('Нікнейм').props.value).not.toBe('Стара відповідь');
 await fireEvent.press(screen.getByRole('button',{name:'Зберегти нікнейм'}));await screen.findByText('Нікнейм збережено.');
});

test('оновлення року залишає дані акаунта на місці та блокує редагування до завершення читання',async()=>{
 await open();await screen.findByText('demo@example.test');
 let confirm!:(value:ReturnType<typeof profile>)=>void;
 read.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));
 await fireEvent.press(screen.getByRole('button',{name:'Попередній рік'}));
 expect(screen.getByText('demo@example.test')).toBeTruthy();expect(screen.getByLabelText('Нікнейм').props.editable).toBe(false);
 expect(screen.getByLabelText('Оновлення календаря')).toBeTruthy();
 const call=read.mock.calls[1];await act(async()=>confirm(profile(call[1],call[2])));
 expect(screen.getByLabelText('Нікнейм').props.editable).toBe(true);expect(screen.getByText('demo@example.test')).toBeTruthy();
});
