import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { api, authApi } from '../lib/api';
import '../styles/dashboard.css';

const ROOM_CODE_STORAGE_KEY = 'vzvonke:last-room-code';
const SHARE_LINK_STORAGE_KEY = 'vzvonke:last-share-link';

const getProfileFormFromUser = (profile) => ({
  name: profile?.name || '',
  login: profile?.login || '',
  email: profile?.email || '',
});

const readStoredValue = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const localizeApiMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return '';

  const dictionary = new Map([
    ['The file failed to upload.', 'Не удалось загрузить файл.'],
    ['The avatar failed to upload.', 'Не удалось загрузить аватар.'],
    ['The avatar field must be an image.', 'Файл аватара должен быть изображением.'],
    ['The avatar field must be a file of type: jpg, jpeg, png, webp, gif.', 'Аватар должен быть в формате: jpg, jpeg, png, webp, gif.'],
    ['The avatar field must not be greater than 10240 kilobytes.', 'Размер аватара не должен превышать 10 МБ.'],
    ['The file field must not be greater than 10240 kilobytes.', 'Размер файла не должен превышать 10 МБ.'],
    ['Message or file is required', 'Нужно добавить текст сообщения или файл.'],
    ['Join room before sending messages', 'Сначала войдите в комнату, затем отправляйте сообщения.'],
    ['Room not found', 'Комната не найдена.'],
    ['Participant not found', 'Участник не найден.'],
  ]);

  return dictionary.get(text) || text;
};

const Dashboard = () => {
  const { user, token: authToken, logout, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');

  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(() => roomParam || readStoredValue(ROOM_CODE_STORAGE_KEY));
  const [activeRoom, setActiveRoom] = useState(null);
  const [shareLink, setShareLink] = useState(() => readStoredValue(SHARE_LINK_STORAGE_KEY));
  const [copyStatus, setCopyStatus] = useState('');
  const [sharebarOpen, setSharebarOpen] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileForm, setProfileForm] = useState(() => getProfileFormFromUser(user));
  const [error, setError] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [handNotice, setHandNotice] = useState('');
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [sharingScreen, setSharingScreen] = useState(false);
  const [connectingRoom, setConnectingRoom] = useState(false);
  const [focusedPeerId, setFocusedPeerId] = useState(null); // 'local' | peerId | null
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(null); // 'chat' | 'users' | null
  const [moreOpen, setMoreOpen] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [devicePickerOpen, setDevicePickerOpen] = useState(null); // 'audio' | 'video' | null
  const avatarInputRef = useRef(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const consumerByProducerRef = useRef(new Map());
  const remoteByPeerRef = useRef(new Map());
  const localProducersRef = useRef([]);
  const localStreamRef = useRef(null);
  const micProducerRef = useRef(null);
  const camProducerRef = useRef(null);
  const screenTrackRef = useRef(null);
  const lastCameraTrackRef = useRef(null);
  const lastVideoEnabledBeforeShareRef = useRef(true);
  const activeRoomIdRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const chatInputRef = useRef(null);
  const emojiPopoverRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const moreMenuRef = useRef(null);
  const audioPickerRef = useRef(null);
  const videoPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const handNoticeTimerRef = useRef(null);

  const signalingUrl = import.meta.env.VITE_MEDIASOUP_SIGNALING_URL || 'http://localhost:4001';
  const requireAuthForCalls = String(import.meta.env.VITE_REQUIRE_AUTH_FOR_CALLS ?? 'false') === 'true';
  const currentDisplayName = user ? (user?.name || user?.login || 'Пользователь') : (userName || 'Гость');

  const emojiPickerTheme = useMemo(() => 'light', []);

  const formatBytes = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const size = value / 1024 ** idx;
    const fixed = idx === 0 ? 0 : size < 10 ? 1 : 0;
    return `${size.toFixed(fixed)} ${units[idx]}`;
  };

  const guessFileKind = (mime, name) => {
    const safeMime = String(mime || '').toLowerCase();
    const safeName = String(name || '').toLowerCase();
    if (safeMime.startsWith('image/')) return 'image';
    if (!safeMime.startsWith('image/') && /\.(jpe?g|png|gif|webp|svg|bmp|ico)$/i.test(safeName)) return 'image';
    if (safeMime.startsWith('video/')) return 'video';
    if (safeMime.startsWith('audio/')) return 'audio';
    if (safeMime.includes('pdf') || safeName.endsWith('.pdf')) return 'pdf';
    if (safeMime.includes('zip') || safeName.endsWith('.zip') || safeName.endsWith('.rar') || safeName.endsWith('.7z')) return 'archive';
    return 'file';
  };

  const isImageAttachment = (mime, name) => guessFileKind(mime, name) === 'image';

  const getBackendPublicOrigin = () => {
    const custom = (import.meta.env.VITE_APP_BASE_URL || '').trim().replace(/\/+$/, '');
    if (custom) return custom;
    const api = import.meta.env.VITE_API_URL || '';
    if (typeof api === 'string' && api.startsWith('http')) {
      try {
        const u = new URL(api);
        const basePath = u.pathname.replace(/\/?api\/?$/i, '');
        return `${u.origin}${basePath.replace(/\/+$/, '')}`;
      } catch {
        /* noop */
      }
    }
    return window.location.origin;
  };

  const resolveAttachmentUrl = (url) => {
    if (!url) return '';
    const s = String(url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    const origin = getBackendPublicOrigin();
    if (s.startsWith('/')) return `${origin}${s}`;
    return `${origin}/${s.replace(/^\/+/, '')}`;
  };

  const currentUserAvatarUrl = resolveAttachmentUrl(user?.avatar_url || '');

  const formatAttachmentDisplayName = (name) => {
    let s = String(name || '').trim();
    if (!s) return 'Файл';
    try {
      s = decodeURIComponent(s);
    } catch {
      /* noop */
    }
    const segment = /[/\\]/.test(s) ? s.replace(/^.*[/\\]/, '') : s;
    const cleaned = segment.trim();
    return cleaned || 'Файл';
  };

  const shortFileTypeLabel = (mime) => {
    const m = String(mime || '').toLowerCase();
    if (!m) return '';
    if (m === 'application/pdf') return 'PDF';
    if (m.includes('wordprocessingml')) return 'Word';
    if (m.includes('spreadsheetml')) return 'Excel';
    if (m.includes('presentationml')) return 'PowerPoint';
    if (m.startsWith('text/')) return 'Текст';
    if (m.startsWith('audio/')) return 'Аудио';
    if (m.startsWith('video/')) return 'Видео';
    const parts = m.split('/');
    if (parts.length >= 2) {
      const tail = parts[1].split(';')[0];
      return tail.length > 20 ? `${tail.slice(0, 18)}…` : tail;
    }
    return '';
  };

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const appBaseUrl = (import.meta.env.VITE_APP_BASE_URL || window.location.origin).replace(/\/+$/, '');
  const buildCallLink = (roomUuid) => `${appBaseUrl}/guest?room=${encodeURIComponent(roomUuid)}`;
  const buildLoginLink = (roomUuid) => {
    const nextPath = `/guest?room=${encodeURIComponent(roomUuid)}`;
    return `${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`;
  };

  const extractRoomCode = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed);
        return url.searchParams.get('room') || '';
      } catch {
        return '';
      }
    }
    const match = trimmed.match(/room=([^&]+)/);
    if (match) return match[1];
    return trimmed;
  };

  useEffect(() => {
    if (!roomParam) return;
    setRoomCodeInput(roomParam);
  }, [roomParam]);

  useEffect(() => {
    try {
      const value = roomCodeInput.trim();
      if (value) localStorage.setItem(ROOM_CODE_STORAGE_KEY, value);
      else localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, [roomCodeInput]);

  useEffect(() => {
    try {
      const value = shareLink.trim();
      if (value) localStorage.setItem(SHARE_LINK_STORAGE_KEY, value);
      else localStorage.removeItem(SHARE_LINK_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, [shareLink]);

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyStatus('Скопировано');
    } catch {
      const input = document.createElement('textarea');
      input.value = shareLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopyStatus('Скопировано');
    } finally {
      setTimeout(() => setCopyStatus(''), 1500);
    }
  };

  const formatMessageTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const requestSocket = (socket, event, payload) =>
    new Promise((resolve, reject) => {
      socket.emit(event, payload, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audios = devices.filter((device) => device.kind === 'audioinput');
      const videos = devices.filter((device) => device.kind === 'videoinput');
      setAudioInputs(audios);
      setVideoInputs(videos);

      if (!selectedAudioInput && audios.length > 0) {
        setSelectedAudioInput(audios[0].deviceId);
      }
      if (!selectedVideoInput && videos.length > 0) {
        setSelectedVideoInput(videos[0].deviceId);
      }
    } catch {
      // noop: browser may block before first media permission.
    }
  }, [selectedAudioInput, selectedVideoInput]);

  const closeRoomConnections = useCallback(() => {
    setFocusedPeerId(null);
    setEmojiOpen(false);
    setImagePreview(null);
    setSidebarOpen(null);
    setMoreOpen(false);
    setDevicePickerOpen(null);
    setIsOrganizer(false);
    setHandRaised(false);
    setHandNotice('');
    if (handNoticeTimerRef.current) {
      window.clearTimeout(handNoticeTimerRef.current);
      handNoticeTimerRef.current = null;
    }
    for (const { consumer } of consumerByProducerRef.current.values()) {
      consumer.close();
    }
    consumerByProducerRef.current.clear();

    localProducersRef.current.forEach((producer) => producer.close());
    localProducersRef.current = [];
    micProducerRef.current = null;
    camProducerRef.current = null;
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    lastCameraTrackRef.current = null;
    setSharingScreen(false);

    if (sendTransportRef.current) sendTransportRef.current.close();
    if (recvTransportRef.current) recvTransportRef.current.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;

    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = null;
    deviceRef.current = null;
    activeRoomIdRef.current = null;
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    remoteByPeerRef.current.clear();
    setRemoteParticipants([]);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setChatMessages([]);
    setChatInput('');
  }, []);

  const consumeProducer = async (producerMeta, roomIdOverride = null) => {
    const socket = socketRef.current;
    const recvTransport = recvTransportRef.current;
    const device = deviceRef.current;
    if (!socket || !recvTransport || !device) return;
    const producerId = producerMeta?.producerId;
    if (!producerId) return;
    if (consumerByProducerRef.current.has(producerId)) return;
    const roomId = roomIdOverride || activeRoomIdRef.current;
    if (!roomId) return;

    const data = await requestSocket(socket, 'consume', {
      roomId,
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    const consumer = await recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    const stream = new MediaStream([consumer.track]);
    const peerId = data.peerId || producerMeta?.peerId || producerId;
    const displayName = data.displayName || producerMeta?.displayName || 'Участник';
    const kind = data.producerKind || data.kind;

    consumerByProducerRef.current.set(data.producerId, {
      consumer,
      consumerId: consumer.id,
      stream,
      peerId,
      kind,
    });

    const current = remoteByPeerRef.current.get(peerId) || {
      peerId,
      displayName,
      avatarUrl: data.avatarUrl || producerMeta?.avatarUrl || null,
      cameraEnabled: data.cameraEnabled !== false && producerMeta?.cameraEnabled !== false,
      handRaised: data.handRaised === true || producerMeta?.handRaised === true,
      videoStream: null,
      audioStream: null,
    };
    current.displayName = displayName;
    current.avatarUrl = data.avatarUrl || producerMeta?.avatarUrl || current.avatarUrl || null;
    current.cameraEnabled = data.cameraEnabled !== false && producerMeta?.cameraEnabled !== false;
    current.handRaised = data.handRaised === true || producerMeta?.handRaised === true || current.handRaised === true;
    if (kind === 'audio') current.audioStream = stream;
    else current.videoStream = stream;
    remoteByPeerRef.current.set(peerId, current);
    setRemoteParticipants(Array.from(remoteByPeerRef.current.values()));

    await requestSocket(socket, 'resumeConsumer', {
      roomId,
      consumerId: consumer.id,
    });
  };

  const syncRemoteProducers = async (roomId) => {
    const socket = socketRef.current;
    if (!socket || !roomId) return;

    const producersData = await requestSocket(socket, 'getProducers', { roomId });
    for (const producerMeta of producersData.producers || []) {
      await consumeProducer(producerMeta, roomId);
    }
  };

  const connectToRoom = async (roomId, displayName) => {
    setError('');
    if (requireAuthForCalls && !authToken) {
      setError('Войдите в аккаунт, чтобы участвовать в звонке.');
      return;
    }
    setConnectingRoom(true);
    closeRoomConnections();

    try {
      const socket = io(signalingUrl, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('newProducer', async ({ producerId, peerId, displayName: producerDisplayName, avatarUrl, cameraEnabled, handRaised }) => {
        try {
          await consumeProducer({ producerId, peerId, displayName: producerDisplayName, avatarUrl, cameraEnabled, handRaised }, roomId);
        } catch (err) {
          setError(err.message || 'Ошибка получения нового потока');
        }
      });

      socket.on('peerMediaState', ({ peerId, cameraEnabled }) => {
        const peer = remoteByPeerRef.current.get(peerId);
        if (!peer) return;
        peer.cameraEnabled = cameraEnabled !== false;
        remoteByPeerRef.current.set(peerId, peer);
        setRemoteParticipants(Array.from(remoteByPeerRef.current.values()));
      });

      socket.on('peerHandRaise', ({ peerId, handRaised: raised }) => {
        if (peerId === socket.id) {
          setHandRaised(raised === true);
          return;
        }
        const peer = remoteByPeerRef.current.get(peerId);
        if (!peer) return;
        const wasRaised = peer.handRaised === true;
        peer.handRaised = raised === true;
        remoteByPeerRef.current.set(peerId, peer);
        setRemoteParticipants(Array.from(remoteByPeerRef.current.values()));
        if (!wasRaised && raised === true) {
          const peerName = peer.displayName || 'Участник';
          setHandNotice(`${peerName} поднял руку`);
          if (handNoticeTimerRef.current) {
            window.clearTimeout(handNoticeTimerRef.current);
          }
          handNoticeTimerRef.current = window.setTimeout(() => {
            setHandNotice('');
            handNoticeTimerRef.current = null;
          }, 2600);
        }
      });

      socket.on('producerClosed', ({ producerId }) => {
        const consumed = consumerByProducerRef.current.get(producerId);
        if (consumed) {
          consumed.consumer.close();
          consumerByProducerRef.current.delete(producerId);

          const peer = remoteByPeerRef.current.get(consumed.peerId);
          if (peer) {
            if (consumed.kind === 'audio') peer.audioStream = null;
            else peer.videoStream = null;

            if (!peer.videoStream && !peer.audioStream) {
              remoteByPeerRef.current.delete(consumed.peerId);
            } else {
              remoteByPeerRef.current.set(consumed.peerId, peer);
            }
          }
        }
        setRemoteParticipants(Array.from(remoteByPeerRef.current.values()));
      });

      socket.on('newMessage', (message) => {
        setChatMessages((prev) => [...prev, message]);
      });

      socket.on('roomEnded', () => {
        setError('Организатор завершил звонок.');
        closeRoomConnections();
        setActiveRoom(null);
        setSharebarOpen(false);
      });

      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });

      const joinData = await requestSocket(socket, 'joinRoom', {
        roomId,
        displayName,
        avatarUrl: currentUserAvatarUrl || null,
        accessToken: authToken || null,
      });
      setIsOrganizer(Boolean(joinData?.isOrganizer));
      activeRoomIdRef.current = roomId;
      const device = new Device();
      await device.load({ routerRtpCapabilities: joinData.rtpCapabilities });
      deviceRef.current = device;

      const sendParams = await requestSocket(socket, 'createWebRtcTransport', { roomId });
      const sendTransport = device.createSendTransport(sendParams);
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        requestSocket(socket, 'connectTransport', { roomId, transportId: sendTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        requestSocket(socket, 'produce', { roomId, transportId: sendTransport.id, kind, rtpParameters })
          .then((res) => callback({ id: res.producerId }))
          .catch(errback);
      });

      const recvParams = await requestSocket(socket, 'createWebRtcTransport', { roomId });
      const recvTransport = device.createRecvTransport(recvParams);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        requestSocket(socket, 'connectTransport', { roomId, transportId: recvTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
      });
      // Join muted and without camera by default.
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(false);
      setVideoEnabled(false);

      for (const track of stream.getTracks()) {
        const producer = await sendTransport.produce({ track });
        localProducersRef.current.push(producer);
        if (track.kind === 'audio') micProducerRef.current = producer;
        if (track.kind === 'video') camProducerRef.current = producer;
      }

      for (const producerMeta of joinData.producers || []) {
        await consumeProducer(producerMeta, roomId);
      }
      await requestSocket(socket, 'updateMediaState', { roomId, cameraEnabled: false });
      const messagesData = await requestSocket(socket, 'getMessages', { roomId });
      setChatMessages(messagesData.messages || []);
      await syncRemoteProducers(roomId);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = setInterval(() => {
        syncRemoteProducers(roomId).catch(() => {
          // ignore transient sync errors
        });
      }, 10000);

      setActiveRoom({ roomId, displayName });
    } catch (err) {
      closeRoomConnections();
      setError(err?.message || 'Не удалось подключиться к комнате.');
    } finally {
      setConnectingRoom(false);
    }
  };

  const replaceLocalTrack = async (kind, nextTrack) => {
    const producer = kind === 'audio' ? micProducerRef.current : camProducerRef.current;
    if (!producer) return;
    const oldTrack = producer.track;
    await producer.replaceTrack({ track: nextTrack });
    if (oldTrack) oldTrack.stop();

    setLocalStream((prev) => {
      if (!prev) return prev;
      const stream = new MediaStream(prev.getTracks().filter((track) => track.kind !== kind));
      stream.addTrack(nextTrack);
      localStreamRef.current = stream;
      return stream;
    });
  };

  const handleAudioInputChange = async (deviceId) => {
    setSelectedAudioInput(deviceId);
    if (!activeRoom || !deviceId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const [nextAudioTrack] = stream.getAudioTracks();
      if (!nextAudioTrack) return;
      await replaceLocalTrack('audio', nextAudioTrack);
      nextAudioTrack.enabled = audioEnabled;
    } catch {
      setError('Не удалось переключить микрофон.');
    }
  };

  const handleVideoInputChange = async (deviceId) => {
    setSelectedVideoInput(deviceId);
    if (!activeRoom || !deviceId || sharingScreen) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const [nextVideoTrack] = stream.getVideoTracks();
      if (!nextVideoTrack) return;
      await replaceLocalTrack('video', nextVideoTrack);
      nextVideoTrack.enabled = videoEnabled;
    } catch {
      setError('Не удалось переключить камеру.');
    }
  };

  const restoreCameraTrack = async () => {
    if (!camProducerRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
    });
    const [cameraTrack] = stream.getVideoTracks();
    if (!cameraTrack) return;
    await replaceLocalTrack('video', cameraTrack);
    cameraTrack.enabled = videoEnabled;
  };

  const toggleScreenShare = async () => {
    if (!activeRoom || !camProducerRef.current) return;

    if (sharingScreen) {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      try {
        await restoreCameraTrack();
      } catch {
        setError('Не удалось вернуть камеру после демонстрации экрана.');
      }
      setSharingScreen(false);
      return;
    }

    try {
      lastVideoEnabledBeforeShareRef.current = videoEnabled;
      lastCameraTrackRef.current = camProducerRef.current.track || null;
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [screenTrack] = displayStream.getVideoTracks();
      if (!screenTrack) return;

      screenTrackRef.current = screenTrack;
      await replaceLocalTrack('video', screenTrack);
      // Screen share must be visible even if camera was toggled off.
      screenTrack.enabled = true;
      if (!videoEnabled) setVideoEnabled(true);
      setSharingScreen(true);

      screenTrack.onended = async () => {
        screenTrackRef.current = null;
        try {
          await restoreCameraTrack();
        } catch {
          setError('Не удалось вернуть камеру после завершения демонстрации.');
        }
        setSharingScreen(false);
      };
    } catch {
      setError('Не удалось начать демонстрацию экрана.');
    }
  };

  const insertEmoji = (emoji) => {
    const inputEl = chatInputRef.current;
    if (!inputEl) {
      setChatInput((prev) => `${prev}${emoji}`);
      return;
    }
    const start = inputEl.selectionStart ?? chatInput.length;
    const end = inputEl.selectionEnd ?? chatInput.length;
    const next = `${chatInput.slice(0, start)}${emoji}${chatInput.slice(end)}`;
    setChatInput(next);
    requestAnimationFrame(() => {
      inputEl.focus();
      const pos = start + emoji.length;
      inputEl.setSelectionRange(pos, pos);
    });
  };

  const handleEmojiPick = (emojiData) => {
    // emojiData.emoji - unicode string in emoji-picker-react
    const emoji = emojiData?.emoji;
    if (!emoji) return;
    insertEmoji(emoji);
  };

  const sendChatMessage = async () => {
    const socket = socketRef.current;
    const roomId = activeRoomIdRef.current;
    const text = chatInput.trim();
    if (!socket || !roomId || !text) return;

    try {
      await requestSocket(socket, 'sendMessage', { roomId, text });
      setChatInput('');
      setChatError('');
    } catch (err) {
      setChatError(err?.message || 'Не удалось отправить сообщение.');
    }
  };

  const uploadChatFile = async (file) => {
    const socket = socketRef.current;
    const roomId = activeRoomIdRef.current;
    if (!file || !roomId) return;
    if (!authToken) {
      setChatError('Для отправки файлов нужно войти в аккаунт.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('display_name', currentDisplayName);
      formData.append('message', chatInput.trim() || '');
      formData.append('file', file);

      const response = await api.post(`/rooms/${roomId}/messages`, formData);

      const saved = response.data;
      setChatMessages((prev) => [...prev, saved]);
      if (socket) {
        socket.emit('broadcastMessage', { roomId, message: saved }, () => {});
      }
      setChatInput('');
      setChatError('');
    } catch (err) {
      setChatError(localizeApiMessage(err?.response?.data?.message || err?.message || 'Не удалось отправить файл.'));
    }
  };

  const handleCreate = async () => {
    setLoadingCreate(true);
    setError('');
    try {
      const displayName = currentDisplayName;
      const created = await authApi.createRoom({ title: roomName.trim() });
      const roomId = created?.room?.uuid;
      if (!roomId) {
        throw new Error('Не удалось получить UUID комнаты от сервера.');
      }
      const link = buildCallLink(roomId);
      setShareLink(link);
      setRoomCodeInput(roomId);
      await connectToRoom(roomId, displayName);
    } catch (err) {
      setError(localizeApiMessage(err?.response?.data?.message || err?.message || 'Ошибка создания комнаты.'));
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleJoin = async () => {
    setLoadingJoin(true);
    setError('');
    try {
      const roomUuid = extractRoomCode(roomCodeInput);
      if (!roomUuid) {
        setError('Укажите ссылку или код комнаты.');
        return;
      }

      const displayName = currentDisplayName;

      setShareLink(buildCallLink(roomUuid));
      setRoomCodeInput(roomUuid);
      await connectToRoom(roomUuid, displayName);
    } catch {
      setError('Не удалось подключиться. Проверьте код комнаты.');
    } finally {
      setLoadingJoin(false);
    }
  };

  const leaveRoom = () => {
    closeRoomConnections();
    setActiveRoom(null);
    setSharebarOpen(false);
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const enabled = !audioEnabled;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setAudioEnabled(enabled);
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const enabled = !videoEnabled;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setVideoEnabled(enabled);
    if (screenTrackRef.current) {
      screenTrackRef.current.enabled = enabled;
    }
    const socket = socketRef.current;
    const roomId = activeRoomIdRef.current;
    if (socket && roomId) {
      requestSocket(socket, 'updateMediaState', { roomId, cameraEnabled: enabled }).catch(() => {});
    }
  };

  const toggleHandRaise = async () => {
    const socket = socketRef.current;
    const roomId = activeRoomIdRef.current;
    if (!socket || !roomId) return;
    try {
      const next = !handRaised;
      await requestSocket(socket, 'updateHandRaise', { roomId, handRaised: next });
      setHandRaised(next);
    } catch {
      setError('Не удалось обновить статус поднятой руки.');
    }
  };

  useEffect(() => () => closeRoomConnections(), [closeRoomConnections]);

  useEffect(() => () => {
    if (handNoticeTimerRef.current) {
      window.clearTimeout(handNoticeTimerRef.current);
      handNoticeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!emojiOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (emojiPopoverRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [emojiOpen]);

  useEffect(() => {
    if (!imagePreview) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setImagePreview(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imagePreview]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreMenuRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

  useEffect(() => {
    if (!devicePickerOpen) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (audioPickerRef.current?.contains(target)) return;
      if (videoPickerRef.current?.contains(target)) return;
      setDevicePickerOpen(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [devicePickerOpen]);

  useEffect(() => {
    const refreshTask = window.setTimeout(() => {
      void refreshDevices();
    }, 0);
    if (!navigator.mediaDevices?.addEventListener) {
      return () => window.clearTimeout(refreshTask);
    }
    const onDevicesChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', onDevicesChange);
    return () => {
      window.clearTimeout(refreshTask);
      navigator.mediaDevices.removeEventListener('devicechange', onDevicesChange);
    };
  }, [refreshDevices]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await authApi.updateProfile(formData);
      await refreshProfile();
    } catch (err) {
      const details = err?.response?.data?.errors?.avatar?.[0];
      const message = localizeApiMessage(details || err?.response?.data?.message || 'Не удалось загрузить аватар.');
      setProfileError(message);
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const openProfile = () => {
    if (user) {
      setProfileForm(getProfileFormFromUser(user));
    }
    setProfileError('');
    setProfileSuccess('');
    setProfileOpen(true);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await authApi.updateProfile(profileForm);
      await refreshProfile();
      setProfileSuccess('Профиль обновлен');
    } catch (err) {
      setProfileError(localizeApiMessage(err?.response?.data?.message || 'Не удалось сохранить профиль.'));
    } finally {
      setProfileSaving(false);
    }
  };

  if (activeRoom) {
    const focusedRemote =
      focusedPeerId && focusedPeerId !== 'local'
        ? remoteParticipants.find((participant) => participant.peerId === focusedPeerId) || null
        : null;
    const otherRemoteParticipants = focusedRemote
      ? remoteParticipants.filter((participant) => participant.peerId !== focusedRemote.peerId)
      : remoteParticipants;

    return (
      <div className="room-container">
        <div className="room-topbar room-topbar--overlay">
          <div className="room-topbar__left">
            <div className="room-topbar__title">{roomName?.trim() || 'Видеовстреча'}</div>
            <div className="room-topbar__code">{activeRoom.roomId}</div>
          </div>
          <div className="room-topbar__right">
            {isOrganizer && (
              <span className="room-topbar__organizer-badge" title="У вас есть права организатора">
                Вы организатор
              </span>
            )}
            {focusedPeerId && (
              <button type="button" className="ghost room-topbar__focus-clear" onClick={() => setFocusedPeerId(null)}>
                Сбросить фокус
              </button>
            )}
          </div>
        </div>
        {shareLink && (
          <div className={`room-sharebar ${sharebarOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="room-sharebar__toggle"
              onClick={() => setSharebarOpen((prev) => !prev)}
              aria-expanded={sharebarOpen}
              aria-label={sharebarOpen ? 'Свернуть ссылку приглашения' : 'Показать ссылку приглашения'}
            >
              <span className="room-sharebar__icon" aria-hidden>
                <LinkIcon />
              </span>
            </button>
            <div className="room-sharebar__panel">
              <div className="room-sharebar__actions">
                <input readOnly value={shareLink} />
                <button type="button" className="ghost" onClick={handleCopy}>
                  {copyStatus || 'Копировать'}
                </button>
              </div>
              <div className="share-qr-grid">
                <div className="share-qr-card">
                  <div className="share-qr-card__title">Вход в звонок</div>
                  <QRCodeSVG value={shareLink} size={220} level="M" includeMargin className="share-qr-card__code" />
                </div>
                {extractRoomCode(shareLink) && (
                  <div className="share-qr-card">
                    <div className="share-qr-card__title">Вход через аккаунт</div>
                    <QRCodeSVG
                      value={buildLoginLink(extractRoomCode(shareLink))}
                      size={220}
                      level="M"
                      includeMargin
                      className="share-qr-card__code"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="call-shell">
          {handNotice && <div className="room-toast room-toast--hand">{handNotice}</div>}
          <div className="call-main">
            <div
              className={[
                'room-grid',
                'room-grid--dock',
                sharingScreen ? 'is-sharing' : '',
                focusedPeerId ? 'is-focused' : '',
              ].filter(Boolean).join(' ')}
            >
            {focusedRemote ? (
              <VideoTile
                stream={focusedRemote.videoStream}
                title={focusedRemote.displayName || 'Участник'}
                avatarUrl={focusedRemote.avatarUrl || null}
                forcePlaceholder={focusedRemote.cameraEnabled === false}
                handRaised={focusedRemote.handRaised === true}
                variant="spotlight"
                isFocused
                onFocus={() => setFocusedPeerId(focusedRemote.peerId)}
              />
            ) : null}

            <VideoTile
              stream={localStream}
              title={`${activeRoom.displayName} (Вы)`}
              muted
              avatarUrl={currentUserAvatarUrl || null}
              forcePlaceholder={!videoEnabled && !sharingScreen}
              handRaised={handRaised}
              variant={focusedPeerId === 'local' ? 'spotlight' : (sharingScreen ? 'spotlight' : 'local')}
              isFocused={focusedPeerId === 'local'}
              onFocus={() => setFocusedPeerId('local')}
            />

            {otherRemoteParticipants.map((participant) => (
              <VideoTile
                key={participant.peerId}
                stream={participant.videoStream}
                title={participant.displayName || 'Участник'}
                avatarUrl={participant.avatarUrl || null}
                forcePlaceholder={participant.cameraEnabled === false}
                handRaised={participant.handRaised === true}
                variant={focusedPeerId === participant.peerId ? 'spotlight' : 'remote'}
                isFocused={focusedPeerId === participant.peerId}
                onFocus={() => setFocusedPeerId(participant.peerId)}
              />
            ))}
          {remoteParticipants.map((participant) => (
            <AudioSink key={`audio-${participant.peerId}`} stream={participant.audioStream} />
          ))}
            </div>

            <div className="call-dock">
              <div className="call-dock__inner">
                <div className="call-dock__group">
                  <div className="dock-split dock-split--picker" aria-label="Микрофон" ref={audioPickerRef}>
                    <button
                      type="button"
                      className={`dock-split__main dock-btn ${audioEnabled ? '' : 'is-off'}`}
                      onClick={toggleAudio}
                      aria-pressed={!audioEnabled}
                      title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
                    >
                      <MicIcon />
                    </button>
                    <div className="dock-split__divider" aria-hidden />
                    <div className="dock-split__chevron" aria-label="Выбор микрофона">
                      <button
                        type="button"
                        className={`dock-btn dock-btn--ghost dock-btn--chevron ${devicePickerOpen === 'audio' ? 'is-active' : ''}`}
                        title="Выбрать микрофон"
                        onClick={() => setDevicePickerOpen((prev) => (prev === 'audio' ? null : 'audio'))}
                        aria-expanded={devicePickerOpen === 'audio'}
                      >
                        <ChevronDownIcon />
                      </button>
                      {devicePickerOpen === 'audio' && (
                        <div className="dock-picker__panel" role="menu" aria-label="Список микрофонов">
                          {audioInputs.length === 0 ? (
                            <div className="dock-picker__empty">Микрофоны не найдены</div>
                          ) : (
                            audioInputs.map((device, index) => (
                              <button
                                key={device.deviceId || `mic-${index}`}
                                type="button"
                                className={`dock-picker__item ${selectedAudioInput === device.deviceId ? 'is-selected' : ''}`}
                                onClick={() => {
                                  setDevicePickerOpen(null);
                                  handleAudioInputChange(device.deviceId);
                                }}
                              >
                                {device.label || `Микрофон ${index + 1}`}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="call-dock__group">
                  <div className="dock-split dock-split--picker" aria-label="Камера" ref={videoPickerRef}>
                    <button
                      type="button"
                      className={`dock-split__main dock-btn ${videoEnabled ? '' : 'is-off'}`}
                      onClick={toggleVideo}
                      aria-pressed={!videoEnabled}
                      title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
                    >
                      <CamIcon />
                    </button>
                    <div className="dock-split__divider" aria-hidden />
                    <div className="dock-split__chevron" aria-label="Выбор камеры">
                      <button
                        type="button"
                        className={`dock-btn dock-btn--ghost dock-btn--chevron ${devicePickerOpen === 'video' ? 'is-active' : ''}`}
                        title={sharingScreen ? 'Недоступно во время демонстрации' : 'Выбрать камеру'}
                        disabled={sharingScreen}
                        onClick={() => setDevicePickerOpen((prev) => (prev === 'video' ? null : 'video'))}
                        aria-expanded={devicePickerOpen === 'video'}
                      >
                        <ChevronDownIcon />
                      </button>
                      {devicePickerOpen === 'video' && !sharingScreen && (
                        <div className="dock-picker__panel" role="menu" aria-label="Список камер">
                          {videoInputs.length === 0 ? (
                            <div className="dock-picker__empty">Камеры не найдены</div>
                          ) : (
                            videoInputs.map((device, index) => (
                              <button
                                key={device.deviceId || `cam-${index}`}
                                type="button"
                                className={`dock-picker__item ${selectedVideoInput === device.deviceId ? 'is-selected' : ''}`}
                                onClick={() => {
                                  setDevicePickerOpen(null);
                                  handleVideoInputChange(device.deviceId);
                                }}
                              >
                                {device.label || `Камера ${index + 1}`}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="call-dock__divider" aria-hidden />

                <button
                  type="button"
                  className={`dock-btn ${sharingScreen ? 'is-active' : ''}`}
                  onClick={toggleScreenShare}
                  title={sharingScreen ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
                >
                  <ScreenIcon />
                </button>

                <button
                  type="button"
                  className={`dock-btn dock-btn--ghost ${handRaised ? 'is-active' : ''}`}
                  onClick={toggleHandRaise}
                  title={handRaised ? 'Опустить руку' : 'Поднять руку'}
                >
                  <HandIcon />
                </button>

                <button
                  type="button"
                  className={`dock-btn dock-btn--ghost ${sidebarOpen === 'users' ? 'is-active' : ''}`}
                  onClick={() => setSidebarOpen((prev) => (prev === 'users' ? null : 'users'))}
                  title="Участники"
                >
                  <UsersIcon />
                </button>

                <button
                  type="button"
                  className={`dock-btn dock-btn--ghost ${sidebarOpen === 'chat' ? 'is-active' : ''}`}
                  onClick={() => setSidebarOpen((prev) => (prev === 'chat' ? null : 'chat'))}
                  title="Чат"
                >
                  <ChatIcon />
                  {chatMessages.length > 0 && <span className="dock-badge" aria-hidden />}
                </button>

                <div className="dock-more" ref={moreMenuRef}>
                  <button
                    type="button"
                    className={`dock-btn dock-btn--ghost ${moreOpen ? 'is-active' : ''}`}
                    onClick={() => setMoreOpen((prev) => !prev)}
                    title="Ещё"
                    aria-expanded={moreOpen}
                  >
                    <MoreIcon />
                  </button>
                  {moreOpen && (
                    <div
                      className="dock-more__panel"
                      role="menu"
                      aria-label="Дополнительно"
                    >
                      <button
                        type="button"
                        className="dock-more__item"
                        onClick={() => {
                          setMoreOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        Прикрепить файл
                      </button>
                      {isOrganizer && (
                        <button
                          type="button"
                          className="dock-more__item dock-more__item--danger"
                          onClick={() => {
                            setMoreOpen(false);
                            const roomId = activeRoomIdRef.current;
                            const socket = socketRef.current;
                            if (!socket || !roomId) return;
                            requestSocket(socket, 'endRoom', { roomId }).catch((err) => {
                              setError(err?.message || 'Не удалось завершить звонок.');
                            });
                          }}
                        >
                          Завершить звонок для всех
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) uploadChatFile(file);
                    }}
                  />
                </div>

                <div className="call-dock__divider" aria-hidden />

                <button type="button" className="dock-end-btn" onClick={leaveRoom} title="Выйти из звонка">
                  <EndIcon />
                  <span className="dock-end-btn__label">Выйти</span>
                </button>
              </div>
            </div>
          </div>

          {sidebarOpen && (
            <aside className="call-sidebar" aria-label={sidebarOpen === 'chat' ? 'Чат' : 'Участники'}>
              <div className="call-sidebar__header">
                <div className="call-sidebar__title">{sidebarOpen === 'chat' ? 'Чат' : 'Участники'}</div>
                <button type="button" className="call-sidebar__close" onClick={() => setSidebarOpen(null)} aria-label="Закрыть">
                  <ChevronIcon />
                </button>
              </div>

              <div className="call-sidebar__content">
                {sidebarOpen === 'users' ? (
                  <div className="participants">
                    <div className="participants__meta">В звонке · {remoteParticipants.length + 1}</div>
                    <div className="participants__list">
                      <ParticipantRow name={`${activeRoom.displayName} (Вы)`} avatarUrl={currentUserAvatarUrl || null} muted={!audioEnabled} raised={handRaised} />
                      {remoteParticipants.map((p) => (
                        <ParticipantRow key={p.peerId} name={p.displayName || 'Участник'} avatarUrl={p.avatarUrl || null} muted={false} raised={p.handRaised === true} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="room-chat room-chat--sidebar">
                    <div className="room-chat__messages">
                      {chatMessages.length === 0 ? (
                        <div className="room-chat__empty">Пока нет сообщений</div>
                      ) : (
                        chatMessages.map((message) => {
                          const resolvedUrl = message.attachment_url ? resolveAttachmentUrl(message.attachment_url) : '';
                          const displayName = formatAttachmentDisplayName(message.attachment_name);
                          const showAsImage = Boolean(
                            message.attachment_url && isImageAttachment(message.attachment_mime, message.attachment_name)
                          );
                          const typeLabel = shortFileTypeLabel(message.attachment_mime);
                          const subParts = showAsImage
                            ? (message.attachment_size ? [formatBytes(message.attachment_size)] : [])
                            : [message.attachment_size ? formatBytes(message.attachment_size) : '', typeLabel].filter(Boolean);

                          return (
                          <div
                            key={`${message.id}-${message.created_at}`}
                            className={`room-chat__message ${message.user_id === user?.id ? 'is-mine' : 'is-other'}`}
                          >
                            <span className="room-chat__author">
                              {message.user_id === user?.id ? 'Вы' : (message.display_name || 'Участник')}
                            </span>
                            <span className="room-chat__text">{message.message}</span>
                            {message.attachment_url && showAsImage && (
                              <div className="attachment-card attachment-card--media">
                                <button
                                  type="button"
                                  className="attachment-card__image-link"
                                  onClick={() => setImagePreview({ url: resolvedUrl, name: displayName })}
                                  title="Открыть в полном размере"
                                >
                                  <img
                                    src={resolvedUrl}
                                    alt={displayName}
                                    loading="lazy"
                                    decoding="async"
                                    className="attachment-card__image"
                                  />
                                </button>
                                <div className="attachment-card__media-footer">
                                  <div className="attachment-card__meta attachment-card__meta--footer">
                                    <div className="attachment-card__name">{displayName}</div>
                                    {subParts.length > 0 ? (
                                      <div className="attachment-card__sub">{subParts.join(' · ')}</div>
                                    ) : null}
                                  </div>
                                  <a
                                    className="attachment-card__download attachment-card__download--compact"
                                    href={resolvedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={displayName}
                                  >
                                    Скачать
                                  </a>
                                </div>
                              </div>
                            )}
                            {message.attachment_url && !showAsImage && (
                              <div className="attachment-card">
                                <div className={`attachment-card__icon attachment-card__icon--${guessFileKind(message.attachment_mime, message.attachment_name)}`}>
                                  <AttachmentIcon />
                                </div>
                                <div className="attachment-card__meta">
                                  <div className="attachment-card__name">{displayName}</div>
                                  <div className="attachment-card__sub">
                                    {subParts.join(' · ')}
                                  </div>
                                </div>
                                <a
                                  className="attachment-card__download"
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={displayName}
                                >
                                  Скачать
                                </a>
                              </div>
                            )}
                            <span className="room-chat__time">{formatMessageTime(message.created_at)}</span>
                          </div>
                          );
                        })
                      )}
                    </div>
                    {chatError && <div className="form-error room-chat__error">{chatError}</div>}
                    <div className="room-chat__composer room-chat__composer--sidebar">
                      <input
                        ref={chatInputRef}
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        placeholder="Ваше сообщение…"
                      />
                      <button
                        type="button"
                        className="secondary-btn room-chat__attach"
                        onClick={() => fileInputRef.current?.click()}
                        title="Прикрепить файл"
                      >
                        <AttachmentIcon />
                      </button>
                      <div className="emoji-picker" ref={emojiPopoverRef}>
                        <button
                          ref={emojiButtonRef}
                          type="button"
                          className="secondary-btn emoji-picker__toggle"
                          onClick={() => setEmojiOpen((prev) => !prev)}
                          aria-expanded={emojiOpen}
                          aria-label="Открыть эмодзи"
                        >
                          🙂
                        </button>
                        {emojiOpen && (
                          <div
                            className="emoji-picker__panel"
                            role="dialog"
                            aria-label="Выбор эмодзи"
                          >
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                handleEmojiPick(emojiData);
                                setEmojiOpen(false);
                              }}
                              theme={emojiPickerTheme}
                              width="100%"
                              height={340}
                              searchDisabled={false}
                              skinTonesDisabled={false}
                              previewConfig={{ showPreview: false }}
                              lazyLoadEmojis
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="secondary-btn room-chat__send"
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim()}
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
        {imagePreview && (
          <div className="image-preview-modal" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}>
            <div className="image-preview-modal__content" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="image-preview-modal__close" onClick={() => setImagePreview(null)} aria-label="Закрыть">
                ×
              </button>
              <img src={imagePreview.url} alt={imagePreview.name || 'Изображение'} className="image-preview-modal__image" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <span className="landing__brand-mark">V</span>
          <span>вZвонке</span>
        </div>
        <div className="landing__header-actions">
          {user ? (
            <>
              <div className="profile-chip">
                {currentUserAvatarUrl ? (
                  <img src={currentUserAvatarUrl} alt="Аватар" className="profile-chip__avatar" />
                ) : (
                  <span className="profile-chip__fallback">
                    {(user?.name || user?.login || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              {user?.role === 'admin' && (
                <Link className="secondary-btn landing__admin-link" to="/admin">
                  Админка
                </Link>
              )}
              <button className="secondary-btn" onClick={openProfile}>Профиль</button>
              <button className="secondary-btn" onClick={logout}>Выйти</button>
            </>
          ) : null}
        </div>
      </header>

      <main className="landing__content">
        <section className="landing__left">
          <h1>Видеовстречи без ограничений</h1>
          <p className="muted">
            Бесплатные звонки любого масштаба. Общайтесь с коллегами и друзьями без лимитов по времени.
          </p>

          <div className="meeting-panel">
            <div className="meeting-panel__row">
              {!user && (
                <label>
                  <span>Имя</span>
                  <input
                    placeholder="Ваше имя"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
              )}
              <label>
                <span>Название встречи</span>
                <input
                  placeholder="Например: Диплом, созвон"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
            </div>
            <button
              className="primary-btn"
              onClick={handleCreate}
              disabled={!roomName || (!user && !userName) || loadingCreate || connectingRoom}
            >
              {loadingCreate ? 'Подключаем…' : 'Создать встречу'}
            </button>
          </div>

          <div className="join-panel">
            <div className="join-panel__row">
              {!user && (
                <label>
                  <span>Имя</span>
                  <input
                    placeholder="Ваше имя"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
              )}
              <label>
                <span>Код или ссылка</span>
                <input
                  placeholder="https://.../guest?room=..."
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
              </label>
            </div>
            <button className="secondary-btn" onClick={handleJoin} disabled={(!user && !userName) || loadingJoin || connectingRoom}>
              {loadingJoin ? 'Подключаем…' : 'Присоединиться'}
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}

          {shareLink && (
            <div className="share-block">
              <span>Ссылка для приглашения</span>
              <div className="share-block__actions">
                <input readOnly value={shareLink} />
                <button type="button" className="secondary-btn" onClick={handleCopy}>
                  {copyStatus || 'Копировать'}
                </button>
              </div>
              <div className="share-qr-grid">
                <div className="share-qr-card">
                  <div className="share-qr-card__title">Быстрый вход в звонок</div>
                  <QRCodeSVG value={shareLink} size={220} level="M" includeMargin className="share-qr-card__code" />
                </div>
                {extractRoomCode(shareLink) && (
                  <div className="share-qr-card">
                    <div className="share-qr-card__title">Войти в аккаунт и перейти в звонок</div>
                    <QRCodeSVG
                      value={buildLoginLink(extractRoomCode(shareLink))}
                      size={220}
                      level="M"
                      includeMargin
                      className="share-qr-card__code"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="landing__preview" aria-hidden>
          <div className="preview-grid">
            <div className="preview-tile" />
            <div className="preview-tile preview-tile--active" />
            <div className="preview-tile" />
            <div className="preview-tile preview-tile--avatar">V</div>
            <div className="preview-controls">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
      </main>

      {profileOpen && (
        <div className="profile-modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal__header">
              <h2>Профиль</h2>
              <button type="button" className="ghost" onClick={() => setProfileOpen(false)}>Закрыть</button>
            </div>
            <div className="profile-modal__avatar-block">
              {currentUserAvatarUrl ? (
                <img src={currentUserAvatarUrl} alt="Аватар" className="profile-modal__avatar" />
              ) : (
                <span className="profile-modal__avatar profile-modal__avatar--fallback">
                  {(user?.name || user?.login || 'U').slice(0, 1).toUpperCase()}
                </span>
              )}
              <button
                type="button"
                className="secondary-btn profile-chip__upload"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Загружаем…' : 'Сменить аватар'}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleAvatarUpload}
              />
            </div>
            <form className="profile-modal__form" onSubmit={handleProfileSave}>
              <label>
                <span>Имя</span>
                <input name="name" value={profileForm.name} onChange={handleProfileChange} />
              </label>
              <label>
                <span>Логин</span>
                <input name="login" value={profileForm.login} onChange={handleProfileChange} />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" value={profileForm.email} onChange={handleProfileChange} />
              </label>
              {profileError && <div className="form-error">{profileError}</div>}
              {profileSuccess && <div className="profile-success">{profileSuccess}</div>}
              <button type="submit" className="primary-btn" disabled={profileSaving}>
                {profileSaving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const VideoTile = ({
  stream,
  title,
  muted = false,
  variant = 'remote',
  avatarUrl = null,
  forcePlaceholder = false,
  handRaised = false,
  onFocus,
  isFocused = false,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
  }, [stream]);
  const videoTrack = stream?.getVideoTracks?.()[0] || null;
  const hasVideo = Boolean(videoTrack && videoTrack.readyState === 'live');
  const showPlaceholder = forcePlaceholder || !hasVideo;

  return (
    <article
      className={[
        'video-tile',
        `video-tile--${variant}`,
        isFocused ? 'is-focused' : '',
      ].filter(Boolean).join(' ')}
      onClick={onFocus}
      role={onFocus ? 'button' : undefined}
      tabIndex={onFocus ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onFocus) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onFocus();
        }
      }}
      aria-label={onFocus ? `Сфокусировать: ${title}` : undefined}
    >
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      {showPlaceholder && (
        <div className="video-tile__placeholder">
          {avatarUrl ? (
            <img src={avatarUrl} alt={title} className="video-tile__avatar" />
          ) : (
            <span>{title?.slice(0, 1)?.toUpperCase() || 'U'}</span>
          )}
        </div>
      )}
      {handRaised && (
        <div className="video-tile__hand" title="Рука поднята" aria-label="Рука поднята">
          <HandIcon />
        </div>
      )}
      <div className="video-tile__label">{title}</div>
    </article>
  );
};

const AudioSink = ({ stream }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream || null;
    audioRef.current.muted = false;
    if (stream) {
      const tryPlay = async () => {
        try {
          await audioRef.current.play();
        } catch {
          // Browser autoplay policy can block immediately; a user interaction
          // (e.g. any click in app) will allow playback on the next attempt.
        }
      };
      void tryPlay();
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

export default Dashboard;

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10c0 3.87 3.13 7 7 7s7-3.13 7-7" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const CamIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);

const ScreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="9" cy="7" r="4" />
    <path d="M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

const EndIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 13.5c.7.7 1.5 1 2.5 1s1.8-.3 2.5-1" />
    <path d="M2 15c2.2-1.6 5.2-2.5 10-2.5S19.8 13.4 22 15" />
    <path d="M6.5 15.5v3.5" />
    <path d="M17.5 15.5v3.5" />
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const HandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 11V4a1 1 0 0 1 2 0v7" />
    <path d="M11 11V3a1 1 0 0 1 2 0v8" />
    <path d="M14 11V5a1 1 0 0 1 2 0v8" />
    <path d="M17 13V8a1 1 0 0 1 2 0v7c0 3.3-2.7 6-6 6h-1.5a6.5 6.5 0 0 1-5.8-3.5L4 14.5a1.2 1.2 0 1 1 2-1.3L8 16" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07l-1.22 1.22" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-2.12 2.12a5 5 0 0 0 7.07 7.07l1.22-1.22" />
  </svg>
);

const AttachmentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a2 2 0 0 1-2.83-2.83l8.01-8.01" />
  </svg>
);

const ParticipantRow = ({ name, avatarUrl, muted, raised = false }) => {
  const initials = String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join('')
    .toUpperCase();

  return (
    <div className="participant-row">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="participant-row__avatar" />
      ) : (
        <div className="participant-row__avatar participant-row__avatar--fallback">{initials}</div>
      )}
      <div className="participant-row__meta">
        <div className="participant-row__name">{name}</div>
      </div>
      <div className={`participant-row__badge ${raised ? 'is-raised' : (muted ? 'is-muted' : '')}`} title={raised ? 'Рука поднята' : (muted ? 'Микрофон выключен' : 'Микрофон включен')}>
        {raised ? <HandIcon /> : <MicIcon />}
      </div>
    </div>
  );
};
