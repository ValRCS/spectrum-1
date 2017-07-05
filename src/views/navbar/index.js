// @flow
import React, { Component } from 'react';
// $FlowFixMe
import { connect } from 'react-redux';
// $FlowFixMe
import { withRouter } from 'react-router';
// $FlowFixMe
import compose from 'recompose/compose';
import { getCurrentUserProfile } from '../../api/user';
import {
  getNotificationsForNavbar,
  markNotificationsSeenMutation,
  markSingleNotificationSeenMutation,
  markNotificationsReadMutation,
  markDirectMessageNotificationsSeenMutation,
} from '../../api/notification';
import { SERVER_URL } from '../../api';
import Icon from '../../components/icons';
import { Loading } from '../../components/loading';
import { Button } from '../../components/buttons';
import { NotificationDropdown } from './components/notificationDropdown';
import { ProfileDropdown } from './components/profileDropdown';
import Head from '../../components/head';
import { getDistinctNotifications } from '../../views/notifications/utils';
import { storeItem } from '../../helpers/localStorage';
import {
  saveUserDataToLocalStorage,
  logout,
} from '../../actions/authentication';
import {
  Section,
  Nav,
  LogoLink,
  Logo,
  IconDrop,
  IconLink,
  Label,
  UserProfileAvatar,
} from './style';

class Navbar extends Component {
  state: {
    allUnseenCount: number,
    dmUnseenCount: number,
    notifications: Array<Object>,
    subscription: ?Function,
  };

  constructor(props) {
    super(props);
    this.state = {
      ...this.calculateUnseenCounts(),
      subscription: null,
    };
  }

  calculateUnseenCounts = () => {
    const {
      data: { user },
      notificationsQuery: { networkStatus },
      notificationsQuery,
      currentUser,
      match,
    } = this.props;
    const loggedInUser = user || currentUser;

    if (networkStatus === 7) {
      let notifications =
        loggedInUser &&
        notificationsQuery.notifications.edges.map(
          notification => notification.node
        );
      notifications = getDistinctNotifications(notifications);

      /*
        NOTE:
        This is hacky, but by getting the string after the last slash in the current url, we can compare it against in the incoming notifications in order to not show a new notification bubble on views the user is already looking at. This only applies to /messages/:threadId or /thread/:id - by matching this url param with the incoming notification.context.id we can determine whether or not to increment the count.
      */
      const id = match.url.substr(match.url.lastIndexOf('/') + 1);

      const dmUnseenCount =
        notifications &&
        notifications.length > 0 &&
        notifications
          .filter(notification => notification.isSeen === false)
          .filter(notification => {
            // SEE NOTE ABOVE
            if (notification.context.id !== id) return notification;
            // if the notification context matches the current route, go ahead and mark it as seen
            this.props.markSingleNotificationSeen(notification.id);
            return null;
          })
          .filter(
            notification =>
              notification.context.type === 'DIRECT_MESSAGE_THREAD'
          ).length;

      const allUnseenCount =
        notifications &&
        notifications.length > 0 &&
        notifications
          .filter(notification => notification.isSeen === false)
          .filter(notification => {
            // SEE NOTE ABOVE
            if (notification.context.id !== id) return notification;
            // if the notification context matches the current route, go ahead and mark it as seen
            this.props.markSingleNotificationSeen(notification.id);
            return null;
          })
          .filter(
            notification =>
              notification.context.type !== 'DIRECT_MESSAGE_THREAD'
          ).length;

      return {
        allUnseenCount,
        dmUnseenCount,
        notifications,
      };
    } else {
      return;
    }
  };

  formattedCount = count => {
    if (count > 10) {
      return '10+';
    } else if (count > 0) {
      return count;
    } else return false;
  };

  componentDidUpdate(prevProps) {
    // if the query returned notifications
    if (
      this.props.notificationsQuery.notifications &&
      !prevProps.notificationsQuery.notifications
    ) {
      this.setState(this.calculateUnseenCounts());
    }

    // listen for incoming changes and recalculate notifications count
    if (
      prevProps.notificationsQuery.notifications &&
      prevProps.notificationsQuery.notifications.edges.length !==
        this.props.notificationsQuery.notifications.edges.length
    ) {
      this.setState(this.calculateUnseenCounts());
    }

    const { data: { user }, dispatch, history, match } = this.props;

    // if no user was found, escape
    if (!user) return;

    if (prevProps.data.user !== user && user !== null) {
      dispatch(saveUserDataToLocalStorage(user));

      // if the user lands on /home, it means they just logged in. If this code
      // runs, we know a user was returned successfully and set to localStorage,
      // so we can redirect to the root url
      if (match.url === '/home') {
        history.push('/');
      }
      this.subscribe();
    }
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  subscribe = () => {
    this.setState({
      subscription: this.props.subscribeToNewNotifications(),
    });
  };

  unsubscribe = () => {
    const { subscription } = this.state;
    if (subscription) {
      // This unsubscribes the subscription
      subscription();
    }
  };

  markAllNotificationsSeen = () => {
    const { allUnseenCount } = this.state;

    if (allUnseenCount === 0) {
      return null;
    } else {
      this.setState({
        allUnseenCount: 0,
      });
      this.props
        .markAllNotificationsSeen()
        .then(({ data: { markAllNotificationsSeen } }) => {
          // notifs were marked as seen
          this.setState({
            allUnseenCount: 0,
          });
        })
        .catch(err => {
          // error
        });
    }
  };

  markAllNotificationsRead = () => {
    this.props
      .markAllNotificationsRead()
      .then(({ data: { markAllNotificationsRead } }) => {
        // notifs were marked as read
      })
      .catch(err => {
        // error
      });
  };

  markDmNotificationsAsSeen = () => {
    const { dmUnseenCount } = this.state;

    if (dmUnseenCount === 0) {
      return null;
    } else {
      this.setState({
        dmUnseenCount: 0,
      });
      this.props
        .markDirectMessageNotificationsSeen()
        .then(({ data: { markAllUserDirectMessageNotificationsRead } }) => {
          // notifs were marked as seen
        })
        .catch(err => {
          // err
        });
    }
    if (this.interval) {
      clearInterval(this.interval);
    }
  };

  logout = () => {
    if (this.interval) {
      clearInterval(this.interval);
    }
    logout();
  };

  login = () => {
    // log the user in and return them to this page
    return (window.location.href = `${SERVER_URL}/auth/twitter?r=${window.location.href}`);
  };

  render() {
    const {
      match,
      data: { user, networkStatus },
      data,
      currentUser,
    } = this.props;
    const loggedInUser = user || currentUser;
    const currentUserExists =
      loggedInUser !== null && loggedInUser !== undefined;
    const { allUnseenCount, dmUnseenCount, notifications } = this.state;

    if (networkStatus < 8 && currentUserExists) {
      const showUnreadFavicon = dmUnseenCount > 0 || allUnseenCount > 0;

      return (
        <Nav>
          <Head showUnreadFavicon={showUnreadFavicon} />
          <Section left hideOnMobile>
            <LogoLink to="/">
              <Logo src="/img/mark-white.png" role="presentation" />
            </LogoLink>

            <IconLink data-active={match.url === '/' && match.isExact} to="/">
              <Icon glyph="home" />
              <Label>Home</Label>
            </IconLink>

            <IconLink
              data-active={match.url.includes('/messages')}
              to="/messages"
              onClick={this.markDmNotificationsAsSeen}
            >
              <Icon
                glyph={dmUnseenCount > 0 ? 'message-fill' : 'message'}
                withCount={this.formattedCount(dmUnseenCount)}
              />
              <Label>Messages</Label>
            </IconLink>

            <IconLink data-active={match.url === '/explore'} to="/explore">
              <Icon glyph="explore" />
              <Label>Explore</Label>
            </IconLink>
          </Section>

          <Section right hideOnMobile>
            <IconDrop
              onMouseLeave={this.markAllNotificationsSeen}
              onClick={this.markAllNotificationsSeen}
            >
              <IconLink
                data-active={match.url === '/notifications'}
                to="/notifications"
              >
                <Icon
                  glyph={
                    allUnseenCount > 0 ? 'notification-fill' : 'notification'
                  }
                  withCount={this.formattedCount(allUnseenCount)}
                />
              </IconLink>
              <NotificationDropdown
                rawNotifications={notifications}
                markAllRead={this.markAllNotificationsRead}
                currentUser={loggedInUser}
                width={'480px'}
              />
            </IconDrop>

            <IconDrop>
              <IconLink
                data-active={match.url === `/users/${loggedInUser.username}`}
                to={`/users/${loggedInUser.username}`}
              >
                <UserProfileAvatar
                  src={`${loggedInUser.profilePhoto}`}
                  isPro={loggedInUser.isPro}
                />
              </IconLink>
              <ProfileDropdown logout={this.logout} user={loggedInUser} />
            </IconDrop>
          </Section>
          <Section hideOnDesktop>
            <IconLink data-active={match.url === '/' && match.isExact} to="/">
              <Icon glyph="home" />
              <Label>Home</Label>
            </IconLink>

            <IconLink
              data-active={match.url.includes('/messages')}
              to="/messages"
              onClick={this.markDmNotificationsAsSeen}
            >
              <Icon
                glyph={dmUnseenCount > 0 ? 'message-fill' : 'message'}
                withCount={this.formattedCount(dmUnseenCount)}
              />

              <Label>Messages</Label>
            </IconLink>
            <IconLink
              data-active={match.url === '/notifications'}
              to="/notifications"
            >
              <Icon
                glyph={
                  allUnseenCount > 0 ? 'notification-fill' : 'notification'
                }
                withCount={this.formattedCount(allUnseenCount)}
              />
              <Label>Notifications</Label>
            </IconLink>

            <IconLink data-active={match.url === '/explore'} to="/explore">
              <Icon glyph="explore" />
              <Label>Explore</Label>
            </IconLink>

            <IconLink
              data-active={match.url === `/users/${loggedInUser.username}`}
              to={`/users/${loggedInUser.username}`}
            >
              <Icon glyph="profile" />
              <Label>Profile</Label>
            </IconLink>
          </Section>
        </Nav>
      );
    } else if (networkStatus >= 7) {
      return (
        <Nav>
          <Section left hideOnMobile>
            <LogoLink to="/">
              <Logo src="/img/mark-white.png" role="presentation" />
            </LogoLink>
            <IconLink data-active={match.url === '/explore'} to="/explore">
              <Icon glyph="explore" />
              <Label>Explore</Label>
            </IconLink>
          </Section>
          <Section right>
            <Button onClick={this.login} icon="twitter">
              Sign in
            </Button>
          </Section>
        </Nav>
      );
    } else {
      return (
        <Nav>
          <LogoLink to="/">
            <Logo src="/img/mark-white.png" role="presentation" />
          </LogoLink>
          <Loading size={'20'} color={'bg.default'} />
        </Nav>
      );
    }
  }
}

const mapStateToProps = state => ({
  currentUser: state.users.currentUser,
});
export default compose(
  getCurrentUserProfile,
  getNotificationsForNavbar,
  markSingleNotificationSeenMutation,
  markNotificationsSeenMutation,
  markNotificationsReadMutation,
  markDirectMessageNotificationsSeenMutation,
  withRouter,
  connect(mapStateToProps)
)(Navbar);
