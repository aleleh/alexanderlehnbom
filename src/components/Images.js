import React from 'react';
import { Container, Row, Col, Image } from 'react-bootstrap';

const Images = () => {
  return (
    <Container id="images" className="my-5">
      <Row>
        <Col xs={4} md={4} lg={4} className="image-container">
          <Image src="./img43.jpg" className="custom-image" fluid />
          <Image src="./img5.jpg" className="custom-image" fluid />
        </Col>
        <Col xs={4} md={4} lg={4} className="image-container">
          <Image src="./img4.jpg" className="custom-image" fluid />
          <Image src="./img3.jpg" className="custom-image" fluid />
        </Col>
        <Col xs={4} md={4} lg={4} className="image-container">
          <Image src="./img100.jpg" className="custom-image" fluid />
          <Image src="./img6.jpg" className="custom-image" fluid />
        </Col>
      </Row>
    </Container>
  );
};

export default Images;
