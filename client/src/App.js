import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import axios from 'axios';
import styled from 'styled-components';
import { Heart, HeartFill } from 'react-bootstrap-icons';
import Auth from './components/Auth';

//styled-components
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
`;

const ImageCard = styled.div`
  position: relative;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
`;

const ImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 200px;
  background-color: #f0f0f0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: none;
  }

  &.loading img {
    display: none; 
  }

  &.loaded img {
    display: block; 
  }
`;

const ImageOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;

  ${ImageCard}:hover & {
    opacity: 1;
  }
`;

const LikeButton = styled.button`
  background: none;
  border: none;
  color: ${props => (props.isLiked ? '#ff4d4d' : 'white')};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px;

  &:hover {
    transform: scale(1.1);
  }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 20px;
`;

function App() {
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [likes, setLikes] = useState({});
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // axios
  axios.defaults.withCredentials = true;

  // check user login status
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.log('not login');
    } finally {
      setIsLoading(false);
    }
  };

  // handle login/resgier success
  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  // handle logout
  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setUser(null);
    } catch (error) {
      console.error('logout failed:', error);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchImages = useCallback(async () => {
    try {
      const response = await axios.get(`/api/images?page=${page}`);
      const { images: newImages, hasMore: moreImages } = response.data;

      setImages(prev => {
        const uniqueImages = [...prev];
        newImages.forEach(newImage => {
          if (!uniqueImages.find(img => img.id === newImage.id)) {
            uniqueImages.push(newImage);
          }
        });
        return uniqueImages;
      });

      setHasMore(moreImages);
      setPage(prev => prev + 1);
      setError(null);
    } catch (error) {
      console.error('failed to fetch images:', error);
      setError('failed to fetch images');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  // initial load
  useEffect(() => {
    fetchImages();
  }, []); // remove fetchImages dependency to avoid circular calls

  useEffect(() => {
    if (user) {
      fetchImages(); // user login then load images
    }
  }, [user]); // depend on user status

  const handleLike = async (imageId) => {
    if (!user) {
      alert('please login first');
      return;
    }

    try {
      const response = await axios.post(`/api/images/${imageId}/like`, { user: user });
      setLikes(prev => ({
        ...prev,
        [imageId]: {
          count: response.data.likes,
          liked: response.data.liked
        }
      }));
    } catch (error) {
      console.error('failed to like image:', error);
    }
  };

  const fetchLikes = async (imageId) => {
    try {
      const response = await axios.get(`/api/images/${imageId}/likes?user=${user.id}`);
      setLikes(prev => ({
        ...prev,
        [imageId]: {
          count: response.data.likes,
          liked: response.data.liked
        }
      }));
    } catch (error) {
      console.error('failed to fetch like status:', error);
    }
  };

  useEffect(() => {
    // get all images like status
    images.forEach(image => {
      fetchLikes(image.id);
    });
  }, [images]);

  if (isLoading) {
    return (
      <div>
        <LoadingText>loading...</LoadingText>
        {/* show skeleton screen */}
        <Grid>
          {Array.from({ length: 9 }).map((_, index) => (
            <ImageCard key={index}>
              <ImageWrapper className="loading">
                <div style={{ height: '100%', backgroundColor: '#e0e0e0' }} />
              </ImageWrapper>
            </ImageCard>
          ))}
        </Grid>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (error) {
    return <div>error: {error}</div>;
  }

  return (
    <div>
      <header style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span>welcome, {user.username}</span>
          <button onClick={handleLogout} style={{ marginLeft: '10px' }}>logout</button>
        </div>
      </header>
      <InfiniteScroll
        dataLength={images.length}
        next={fetchImages}
        hasMore={hasMore}
        loader={<LoadingText>loading...</LoadingText>}
        endMessage={<p style={{ textAlign: 'center' }}>all images loaded</p>}
      >
        <Grid>
          {images.map((image) => (
            <ImageCard key={image.id}>
              <ImageWrapper className="loaded">
                <img
                  src={image.download_url}
                  alt={`By ${image.author}`}
                  loading="lazy"
                  onError={(e) => {
                    console.error(`image load failed: ${image.download_url}`);
                    e.target.src = `https://picsum.photos/id/${image.id}/400/400`;
                  }}
                />
                <ImageOverlay>
                  <span>{image.author}</span>
                  <LikeButton
                    onClick={() => handleLike(image.id)}
                    isLiked={likes[image.id]?.liked}
                  >
                    {likes[image.id]?.liked ? <HeartFill /> : <Heart />}
                    <span>{likes[image.id]?.count || 0}</span>
                  </LikeButton>
                </ImageOverlay>
              </ImageWrapper>
            </ImageCard>
          ))}
        </Grid>
      </InfiniteScroll>
    </div>
  );
}

export default App;